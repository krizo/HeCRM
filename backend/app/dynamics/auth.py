import asyncio
import threading
import time
from dataclasses import dataclass

import msal

from app.config import Settings


@dataclass(slots=True)
class _CachedToken:
    value: str
    expires_at: float


class DataverseTokenProvider:
    """Acquires and caches an app-only access token for Dataverse (client-credentials flow)."""

    _LEEWAY_SECONDS = 60  # refresh slightly before actual expiry

    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        self._lock = threading.Lock()
        self._cached: _CachedToken | None = None
        self._app: msal.ConfidentialClientApplication | None = None

    def _msal_app(self) -> msal.ConfidentialClientApplication:
        # Construct lazily — MSAL's authority discovery hits the network on init,
        # so we defer until the first real token is actually needed.
        if self._app is None:
            self._app = msal.ConfidentialClientApplication(
                client_id=self._settings.azure_client_id,
                client_credential=self._settings.azure_client_secret,
                authority=self._settings.authority,
            )
        return self._app

    def _acquire(self) -> str:
        with self._lock:
            now = time.time()
            cached = self._cached
            if cached and cached.expires_at - self._LEEWAY_SECONDS > now:
                return cached.value
            result = self._msal_app().acquire_token_for_client(scopes=[self._settings.dataverse_scope])
            if "access_token" not in result:
                raise RuntimeError(
                    "Failed to acquire Dataverse token: "
                    f"{result.get('error_description') or result}"
                )
            self._cached = _CachedToken(
                value=result["access_token"],
                expires_at=now + float(result.get("expires_in", 3600)),
            )
            return self._cached.value

    async def get_token(self) -> str:
        return await asyncio.to_thread(self._acquire)
