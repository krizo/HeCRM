from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api import accounts, health
from app.config import Settings, get_settings
from app.dynamics.auth import DataverseTokenProvider
from app.dynamics.client import DataverseClient
from app.dynamics.errors import DataverseError


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings: Settings = get_settings()
    token_provider = DataverseTokenProvider(settings)
    client = DataverseClient(settings, token_provider)
    app.state.dataverse = client
    try:
        yield
    finally:
        await client.close()


def create_app(settings: Settings | None = None) -> FastAPI:
    resolved = settings or get_settings()
    app = FastAPI(
        title="HeCRM Backend",
        version="0.1.0",
        description="REST surface over Microsoft Dynamics 365 (Dataverse) for the HeCRM demo.",
        lifespan=lifespan,
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=resolved.cors_allow_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.include_router(health.router)
    app.include_router(accounts.router, prefix="/api")

    @app.exception_handler(DataverseError)
    async def dataverse_exception_handler(_: Request, exc: DataverseError) -> JSONResponse:
        status_code = exc.status_code if 400 <= exc.status_code < 600 else 502
        return JSONResponse(
            status_code=status_code,
            content={"code": exc.code, "message": exc.message},
        )

    return app


app = create_app()
