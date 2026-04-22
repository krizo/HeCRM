from typing import Any

from fastapi import APIRouter, HTTPException, Query, status

from app.dependencies import DataverseClientDep
from app.dynamics.errors import DataverseError
from app.schemas.account import (
    ACCOUNT_SELECT,
    CUSTOMER_TYPE_TO_CODE,
    Account,
    AccountCreate,
    AccountUpdate,
    CustomerType,
    account_create_to_dataverse,
    account_from_dataverse,
    account_update_to_dataverse,
)

router = APIRouter(prefix="/accounts", tags=["accounts"])


@router.get("", response_model=list[Account], summary="List accounts")
async def list_accounts(
    client: DataverseClientDep,
    top: int = Query(default=50, ge=1, le=5000),
    customer_type: CustomerType | None = Query(default=None),
    search: str | None = Query(default=None, description="Case-insensitive substring match on name"),
) -> list[Account]:
    params: dict[str, Any] = {"$select": ACCOUNT_SELECT, "$top": top, "$orderby": "modifiedon desc"}
    filters: list[str] = []
    if customer_type is not None:
        filters.append(f"customertypecode eq {CUSTOMER_TYPE_TO_CODE[customer_type]}")
    if search:
        escaped = search.replace("'", "''")
        filters.append(f"contains(name, '{escaped}')")
    if filters:
        params["$filter"] = " and ".join(filters)
    data = await client.get("/accounts", params=params)
    return [account_from_dataverse(row) for row in data.get("value", [])]


@router.get("/{account_id}", response_model=Account, summary="Get account by id")
async def get_account(account_id: str, client: DataverseClientDep) -> Account:
    try:
        row = await client.get(f"/accounts({account_id})", params={"$select": ACCOUNT_SELECT})
    except DataverseError as exc:
        if exc.status_code == 404:
            raise HTTPException(status_code=404, detail=f"Account {account_id} not found") from exc
        raise
    return account_from_dataverse(row)


@router.post(
    "",
    response_model=Account,
    status_code=status.HTTP_201_CREATED,
    summary="Create account (retail or distributor)",
)
async def create_account(data: AccountCreate, client: DataverseClientDep) -> Account:
    payload = account_create_to_dataverse(data)
    row = await client.post("/accounts", json=payload)
    return account_from_dataverse(row)


@router.patch("/{account_id}", response_model=Account, summary="Update account")
async def update_account(
    account_id: str,
    data: AccountUpdate,
    client: DataverseClientDep,
) -> Account:
    payload = account_update_to_dataverse(data)
    if not payload:
        raise HTTPException(status_code=400, detail="At least one field must be provided")
    try:
        row = await client.patch(f"/accounts({account_id})", json=payload)
    except DataverseError as exc:
        if exc.status_code == 404:
            raise HTTPException(status_code=404, detail=f"Account {account_id} not found") from exc
        raise
    return account_from_dataverse(row)


@router.delete(
    "/{account_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete account",
)
async def delete_account(account_id: str, client: DataverseClientDep) -> None:
    try:
        await client.delete(f"/accounts({account_id})")
    except DataverseError as exc:
        if exc.status_code == 404:
            raise HTTPException(status_code=404, detail=f"Account {account_id} not found") from exc
        raise
