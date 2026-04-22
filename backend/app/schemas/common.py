from pydantic import BaseModel


class ErrorResponse(BaseModel):
    code: str | None = None
    message: str
