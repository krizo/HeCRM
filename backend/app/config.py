from functools import lru_cache

from pydantic import Field, HttpUrl, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    dataverse_url: HttpUrl = Field(..., description="Environment URL, e.g. https://orgXXX.crm.dynamics.com")
    azure_tenant_id: str = Field(..., min_length=1)
    azure_client_id: str = Field(..., min_length=1)
    azure_client_secret: str = Field(..., min_length=1)

    api_version: str = Field(default="v9.2")
    request_timeout_seconds: float = Field(default=30.0, gt=0)
    cors_allow_origins: list[str] = Field(
        default_factory=lambda: ["http://localhost:5173", "http://localhost:3000"]
    )

    @field_validator("cors_allow_origins", mode="before")
    @classmethod
    def _split_csv(cls, value: object) -> object:
        if isinstance(value, str):
            return [origin.strip() for origin in value.split(",") if origin.strip()]
        return value

    @property
    def dataverse_root(self) -> str:
        return str(self.dataverse_url).rstrip("/")

    @property
    def dataverse_api_base(self) -> str:
        return f"{self.dataverse_root}/api/data/{self.api_version}"

    @property
    def dataverse_scope(self) -> str:
        return f"{self.dataverse_root}/.default"

    @property
    def authority(self) -> str:
        return f"https://login.microsoftonline.com/{self.azure_tenant_id}"


@lru_cache
def get_settings() -> Settings:
    return Settings()
