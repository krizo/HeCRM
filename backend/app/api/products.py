from typing import Any

from fastapi import APIRouter, HTTPException, Query, status
from pydantic import BaseModel

from app.dependencies import DataverseClientDep
from app.dynamics.errors import DataverseError
from app.schemas.product import (
    PRODUCT_SELECT,
    Product,
    ProductCreate,
    ProductState,
    ProductUpdate,
    product_create_to_dataverse,
    product_from_dataverse,
    product_update_to_dataverse,
)

router = APIRouter(prefix="/products", tags=["products"])


class UnitInfo(BaseModel):
    schedule_id: str
    schedule_name: str
    unit_id: str
    unit_name: str


@router.get("/units", response_model=list[UnitInfo], summary="List available UoM schedules + primary units")
async def list_units(client: DataverseClientDep) -> list[UnitInfo]:
    """Helper for clients creating products — resolves the UoM GUIDs they need."""
    schedules = await client.get(
        "/uomschedules",
        params={"$select": "uomscheduleid,name"},
    )
    result: list[UnitInfo] = []
    for sched in schedules.get("value", []):
        sched_id = sched["uomscheduleid"]
        units = await client.get(
            "/uoms",
            params={
                "$select": "uomid,name",
                "$filter": f"_uomscheduleid_value eq {sched_id}",
                "$top": 1,
            },
        )
        for unit in units.get("value", []):
            result.append(
                UnitInfo(
                    schedule_id=sched_id,
                    schedule_name=sched.get("name") or "",
                    unit_id=unit["uomid"],
                    unit_name=unit.get("name") or "",
                )
            )
    return result


@router.get("", response_model=list[Product], summary="List products")
async def list_products(
    client: DataverseClientDep,
    top: int = Query(default=50, ge=1, le=5000),
    active_only: bool = Query(default=True, description="Filter to only Active products"),
    search: str | None = Query(default=None),
) -> list[Product]:
    params: dict[str, Any] = {"$select": PRODUCT_SELECT, "$top": top, "$orderby": "name asc"}
    filters: list[str] = []
    if active_only:
        filters.append(f"statecode eq {ProductState.active.value}")
    if search:
        escaped = search.replace("'", "''")
        filters.append(f"(contains(name, '{escaped}') or contains(productnumber, '{escaped}'))")
    if filters:
        params["$filter"] = " and ".join(filters)
    data = await client.get("/products", params=params)
    return [product_from_dataverse(row) for row in data.get("value", [])]


@router.get("/{product_id}", response_model=Product, summary="Get product by id")
async def get_product(product_id: str, client: DataverseClientDep) -> Product:
    try:
        row = await client.get(f"/products({product_id})", params={"$select": PRODUCT_SELECT})
    except DataverseError as exc:
        if exc.status_code == 404:
            raise HTTPException(status_code=404, detail=f"Product {product_id} not found") from exc
        raise
    return product_from_dataverse(row)


@router.post(
    "",
    response_model=Product,
    status_code=status.HTTP_201_CREATED,
    summary="Create product (starts as Draft — call /activate to use in orders)",
)
async def create_product(data: ProductCreate, client: DataverseClientDep) -> Product:
    row = await client.post("/products", json=product_create_to_dataverse(data))
    return product_from_dataverse(row)


@router.patch("/{product_id}", response_model=Product, summary="Update product")
async def update_product(
    product_id: str,
    data: ProductUpdate,
    client: DataverseClientDep,
) -> Product:
    payload = product_update_to_dataverse(data)
    if not payload:
        raise HTTPException(status_code=400, detail="At least one field must be provided")
    try:
        row = await client.patch(f"/products({product_id})", json=payload)
    except DataverseError as exc:
        if exc.status_code == 404:
            raise HTTPException(status_code=404, detail=f"Product {product_id} not found") from exc
        raise
    return product_from_dataverse(row)


@router.post(
    "/{product_id}/activate",
    response_model=Product,
    summary="Transition product from Draft to Active (so it can be used in sales orders)",
)
async def activate_product(product_id: str, client: DataverseClientDep) -> Product:
    try:
        await client.patch(
            f"/products({product_id})",
            json={"statecode": ProductState.active.value, "statuscode": 1},
        )
        row = await client.get(f"/products({product_id})", params={"$select": PRODUCT_SELECT})
    except DataverseError as exc:
        if exc.status_code == 404:
            raise HTTPException(status_code=404, detail=f"Product {product_id} not found") from exc
        raise
    return product_from_dataverse(row)


@router.delete(
    "/{product_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete product (only Draft products can be deleted)",
)
async def delete_product(product_id: str, client: DataverseClientDep) -> None:
    try:
        await client.delete(f"/products({product_id})")
    except DataverseError as exc:
        if exc.status_code == 404:
            raise HTTPException(status_code=404, detail=f"Product {product_id} not found") from exc
        raise
