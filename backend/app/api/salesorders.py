from typing import Any

from fastapi import APIRouter, HTTPException, Query, status

from app.dependencies import DataverseClientDep
from app.dynamics.errors import DataverseError
from app.schemas.salesorder import (
    SALESORDER_SELECT,
    SALESORDERDETAIL_SELECT,
    SalesOrder,
    SalesOrderCreate,
    SalesOrderLine,
    SalesOrderLineCreate,
    SalesOrderUpdate,
    salesorder_create_to_dataverse,
    salesorder_from_dataverse,
    salesorder_line_create_to_dataverse,
    salesorder_line_from_dataverse,
    salesorder_update_to_dataverse,
)

router = APIRouter(prefix="/salesorders", tags=["salesorders"])


@router.get("", response_model=list[SalesOrder], summary="List sales orders")
async def list_salesorders(
    client: DataverseClientDep,
    top: int = Query(default=50, ge=1, le=5000),
    customer_id: str | None = Query(default=None),
) -> list[SalesOrder]:
    params: dict[str, Any] = {
        "$select": SALESORDER_SELECT,
        "$top": top,
        "$orderby": "modifiedon desc",
    }
    if customer_id:
        params["$filter"] = f"_customerid_value eq {customer_id}"
    data = await client.get("/salesorders", params=params)
    return [salesorder_from_dataverse(row) for row in data.get("value", [])]


@router.get("/{order_id}", response_model=SalesOrder, summary="Get sales order by id")
async def get_salesorder(order_id: str, client: DataverseClientDep) -> SalesOrder:
    try:
        row = await client.get(
            f"/salesorders({order_id})", params={"$select": SALESORDER_SELECT}
        )
    except DataverseError as exc:
        if exc.status_code == 404:
            raise HTTPException(status_code=404, detail=f"SalesOrder {order_id} not found") from exc
        raise
    return salesorder_from_dataverse(row)


@router.post(
    "",
    response_model=SalesOrder,
    status_code=status.HTTP_201_CREATED,
    summary="Create sales order header",
)
async def create_salesorder(data: SalesOrderCreate, client: DataverseClientDep) -> SalesOrder:
    row = await client.post("/salesorders", json=salesorder_create_to_dataverse(data))
    return salesorder_from_dataverse(row)


@router.patch("/{order_id}", response_model=SalesOrder, summary="Update sales order")
async def update_salesorder(
    order_id: str,
    data: SalesOrderUpdate,
    client: DataverseClientDep,
) -> SalesOrder:
    payload = salesorder_update_to_dataverse(data)
    if not payload:
        raise HTTPException(status_code=400, detail="At least one field must be provided")
    try:
        row = await client.patch(f"/salesorders({order_id})", json=payload)
    except DataverseError as exc:
        if exc.status_code == 404:
            raise HTTPException(status_code=404, detail=f"SalesOrder {order_id} not found") from exc
        raise
    return salesorder_from_dataverse(row)


@router.delete(
    "/{order_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete sales order",
)
async def delete_salesorder(order_id: str, client: DataverseClientDep) -> None:
    try:
        await client.delete(f"/salesorders({order_id})")
    except DataverseError as exc:
        if exc.status_code == 404:
            raise HTTPException(status_code=404, detail=f"SalesOrder {order_id} not found") from exc
        raise


@router.get(
    "/{order_id}/lines",
    response_model=list[SalesOrderLine],
    summary="List line items for a sales order",
)
async def list_salesorder_lines(order_id: str, client: DataverseClientDep) -> list[SalesOrderLine]:
    params: dict[str, Any] = {
        "$select": SALESORDERDETAIL_SELECT,
        "$filter": f"_salesorderid_value eq {order_id}",
        "$orderby": "createdon asc",
    }
    data = await client.get("/salesorderdetails", params=params)
    return [salesorder_line_from_dataverse(row) for row in data.get("value", [])]


@router.post(
    "/{order_id}/lines",
    response_model=SalesOrderLine,
    status_code=status.HTTP_201_CREATED,
    summary="Add a line item to a sales order",
)
async def add_salesorder_line(
    order_id: str,
    data: SalesOrderLineCreate,
    client: DataverseClientDep,
) -> SalesOrderLine:
    payload = salesorder_line_create_to_dataverse(order_id, data)
    row = await client.post("/salesorderdetails", json=payload)
    return salesorder_line_from_dataverse(row)


@router.delete(
    "/{order_id}/lines/{line_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Remove a line item from a sales order",
)
async def delete_salesorder_line(
    order_id: str,
    line_id: str,
    client: DataverseClientDep,
) -> None:
    try:
        await client.delete(f"/salesorderdetails({line_id})")
    except DataverseError as exc:
        if exc.status_code == 404:
            raise HTTPException(status_code=404, detail=f"Line {line_id} not found") from exc
        raise
