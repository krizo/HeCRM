from typing import Annotated

from fastapi import Depends, Request

from app.dynamics.client import DataverseClient


def get_dataverse_client(request: Request) -> DataverseClient:
    client: DataverseClient | None = getattr(request.app.state, "dataverse", None)
    if client is None:
        raise RuntimeError("Dataverse client is not initialized — check the application lifespan.")
    return client


DataverseClientDep = Annotated[DataverseClient, Depends(get_dataverse_client)]
