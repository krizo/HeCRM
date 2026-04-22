from typing import Any

import httpx

from app.config import Settings
from app.dynamics.auth import DataverseTokenProvider
from app.dynamics.errors import DataverseError

_BASE_HEADERS = {
    "Accept": "application/json",
    "OData-MaxVersion": "4.0",
    "OData-Version": "4.0",
}


class DataverseClient:
    """Thin async wrapper over the Dataverse Web API."""

    def __init__(self, settings: Settings, token_provider: DataverseTokenProvider) -> None:
        self._token_provider = token_provider
        self._http = httpx.AsyncClient(
            base_url=settings.dataverse_api_base,
            timeout=settings.request_timeout_seconds,
        )

    async def close(self) -> None:
        await self._http.aclose()

    async def _auth_headers(self) -> dict[str, str]:
        token = await self._token_provider.get_token()
        return {**_BASE_HEADERS, "Authorization": f"Bearer {token}"}

    async def get(self, path: str, params: dict[str, Any] | None = None) -> dict[str, Any]:
        response = await self._http.get(path, headers=await self._auth_headers(), params=params)
        return self._parse(response)

    async def post(self, path: str, json: dict[str, Any]) -> dict[str, Any]:
        headers = {
            **(await self._auth_headers()),
            "Content-Type": "application/json",
            "Prefer": "return=representation",
        }
        response = await self._http.post(path, headers=headers, json=json)
        return self._parse(response)

    async def patch(self, path: str, json: dict[str, Any]) -> dict[str, Any]:
        headers = {
            **(await self._auth_headers()),
            "Content-Type": "application/json",
            "Prefer": "return=representation",
            "If-Match": "*",
        }
        response = await self._http.patch(path, headers=headers, json=json)
        return self._parse(response)

    async def delete(self, path: str) -> None:
        response = await self._http.delete(path, headers=await self._auth_headers())
        if response.status_code not in (200, 204):
            raise DataverseError.from_response(response)

    @staticmethod
    def _parse(response: httpx.Response) -> dict[str, Any]:
        if response.status_code >= 400:
            raise DataverseError.from_response(response)
        if response.status_code == 204 or not response.content:
            return {}
        return response.json()
