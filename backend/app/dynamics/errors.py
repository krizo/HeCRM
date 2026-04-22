from typing import Any

import httpx


class DataverseError(Exception):
    """Normalized error raised by the Dataverse client on non-2xx responses."""

    def __init__(
        self,
        status_code: int,
        code: str | None,
        message: str,
        details: dict[str, Any] | None = None,
    ) -> None:
        super().__init__(f"[{status_code}] {code or 'DataverseError'}: {message}")
        self.status_code = status_code
        self.code = code
        self.message = message
        self.details = details or {}

    @classmethod
    def from_response(cls, response: httpx.Response) -> "DataverseError":
        try:
            payload = response.json()
            inner = payload.get("error", {}) if isinstance(payload, dict) else {}
            return cls(
                status_code=response.status_code,
                code=inner.get("code"),
                message=inner.get("message") or response.text or "Dataverse error",
                details=inner,
            )
        except ValueError:
            return cls(
                status_code=response.status_code,
                code=None,
                message=response.text or "Dataverse error",
            )
