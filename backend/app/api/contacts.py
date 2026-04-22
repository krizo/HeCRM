from typing import Any

from fastapi import APIRouter, HTTPException, Query, status

from app.dependencies import DataverseClientDep
from app.dynamics.errors import DataverseError
from app.schemas.contact import (
    CONTACT_SELECT,
    Contact,
    ContactCreate,
    ContactUpdate,
    contact_create_to_dataverse,
    contact_from_dataverse,
    contact_update_to_dataverse,
)

router = APIRouter(prefix="/contacts", tags=["contacts"])


@router.get("", response_model=list[Contact], summary="List contacts")
async def list_contacts(
    client: DataverseClientDep,
    top: int = Query(default=50, ge=1, le=5000),
    account_id: str | None = Query(default=None, description="Filter by parent account GUID"),
    search: str | None = Query(default=None, description="Substring match on fullname"),
) -> list[Contact]:
    params: dict[str, Any] = {"$select": CONTACT_SELECT, "$top": top, "$orderby": "modifiedon desc"}
    filters: list[str] = []
    if account_id:
        filters.append(f"_parentcustomerid_value eq {account_id}")
    if search:
        escaped = search.replace("'", "''")
        filters.append(f"contains(fullname, '{escaped}')")
    if filters:
        params["$filter"] = " and ".join(filters)
    data = await client.get("/contacts", params=params)
    return [contact_from_dataverse(row) for row in data.get("value", [])]


@router.get("/{contact_id}", response_model=Contact, summary="Get contact by id")
async def get_contact(contact_id: str, client: DataverseClientDep) -> Contact:
    try:
        row = await client.get(f"/contacts({contact_id})", params={"$select": CONTACT_SELECT})
    except DataverseError as exc:
        if exc.status_code == 404:
            raise HTTPException(status_code=404, detail=f"Contact {contact_id} not found") from exc
        raise
    return contact_from_dataverse(row)


@router.post("", response_model=Contact, status_code=status.HTTP_201_CREATED, summary="Create contact")
async def create_contact(data: ContactCreate, client: DataverseClientDep) -> Contact:
    row = await client.post("/contacts", json=contact_create_to_dataverse(data))
    return contact_from_dataverse(row)


@router.patch("/{contact_id}", response_model=Contact, summary="Update contact")
async def update_contact(
    contact_id: str,
    data: ContactUpdate,
    client: DataverseClientDep,
) -> Contact:
    payload = contact_update_to_dataverse(data)
    if not payload:
        raise HTTPException(status_code=400, detail="At least one field must be provided")
    try:
        row = await client.patch(f"/contacts({contact_id})", json=payload)
    except DataverseError as exc:
        if exc.status_code == 404:
            raise HTTPException(status_code=404, detail=f"Contact {contact_id} not found") from exc
        raise
    return contact_from_dataverse(row)


@router.delete(
    "/{contact_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete contact",
)
async def delete_contact(contact_id: str, client: DataverseClientDep) -> None:
    try:
        await client.delete(f"/contacts({contact_id})")
    except DataverseError as exc:
        if exc.status_code == 404:
            raise HTTPException(status_code=404, detail=f"Contact {contact_id} not found") from exc
        raise
