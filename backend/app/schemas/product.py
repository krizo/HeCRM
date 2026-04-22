from datetime import datetime
from decimal import Decimal
from enum import IntEnum
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class ProductState(IntEnum):
    """Dataverse `product.statecode`: 0=Active, 1=Retired, 2=Draft, 3=Under Revision."""

    active = 0
    retired = 1
    draft = 2
    under_revision = 3


class ProductBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=160)
    product_number: str = Field(..., min_length=1, max_length=100)
    description: str | None = Field(default=None, max_length=2000)
    price: Decimal | None = None
    cost: Decimal | None = None


class ProductCreate(ProductBase):
    unit_id: str = Field(..., description="GUID of the default unit of measure (uomid)")
    unit_schedule_id: str = Field(..., description="GUID of the unit schedule (uomscheduleid)")


class ProductUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=160)
    product_number: str | None = Field(default=None, min_length=1, max_length=100)
    description: str | None = Field(default=None, max_length=2000)
    price: Decimal | None = None
    cost: Decimal | None = None


class Product(ProductBase):
    model_config = ConfigDict(from_attributes=True)
    id: str
    state: ProductState
    unit_id: str | None = None
    unit_schedule_id: str | None = None
    created_on: datetime | None = None
    modified_on: datetime | None = None


PRODUCT_SELECT = ",".join([
    "productid",
    "name",
    "productnumber",
    "description",
    "price",
    "currentcost",
    "statecode",
    "_defaultuomid_value",
    "_defaultuomscheduleid_value",
    "createdon",
    "modifiedon",
])


def product_from_dataverse(row: dict[str, Any]) -> Product:
    return Product(
        id=row["productid"],
        name=row.get("name") or "",
        product_number=row.get("productnumber") or "",
        description=row.get("description"),
        price=Decimal(str(row["price"])) if row.get("price") is not None else None,
        cost=Decimal(str(row["currentcost"])) if row.get("currentcost") is not None else None,
        state=ProductState(row.get("statecode", ProductState.draft.value)),
        unit_id=row.get("_defaultuomid_value"),
        unit_schedule_id=row.get("_defaultuomscheduleid_value"),
        created_on=row.get("createdon"),
        modified_on=row.get("modifiedon"),
    )


def _apply_shared_fields(payload: dict[str, Any], data: ProductBase | ProductUpdate) -> None:
    if data.name is not None:
        payload["name"] = data.name
    if data.product_number is not None:
        payload["productnumber"] = data.product_number
    if data.description is not None:
        payload["description"] = data.description
    if data.price is not None:
        payload["price"] = float(data.price)
    if data.cost is not None:
        payload["currentcost"] = float(data.cost)


def product_create_to_dataverse(data: ProductCreate) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "defaultuomid@odata.bind": f"/uoms({data.unit_id})",
        "defaultuomscheduleid@odata.bind": f"/uomschedules({data.unit_schedule_id})",
    }
    _apply_shared_fields(payload, data)
    return payload


def product_update_to_dataverse(data: ProductUpdate) -> dict[str, Any]:
    payload: dict[str, Any] = {}
    _apply_shared_fields(payload, data)
    return payload
