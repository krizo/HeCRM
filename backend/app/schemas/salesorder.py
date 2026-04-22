from datetime import datetime
from decimal import Decimal
from enum import IntEnum
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class SalesOrderState(IntEnum):
    """Dataverse `salesorder.statecode`: 0=Active, 1=Submitted, 2=Canceled, 3=Fulfilled, 4=Invoiced."""

    active = 0
    submitted = 1
    canceled = 2
    fulfilled = 3
    invoiced = 4


class SalesOrderBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=300)
    description: str | None = Field(default=None, max_length=2000)


class SalesOrderCreate(SalesOrderBase):
    customer_id: str = Field(..., description="Account GUID")
    opportunity_id: str | None = Field(
        default=None,
        description="Optional: the opportunity this order is materializing.",
    )


class SalesOrderUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=300)
    description: str | None = Field(default=None, max_length=2000)


class SalesOrder(SalesOrderBase):
    model_config = ConfigDict(from_attributes=True)
    id: str
    order_number: str | None = None
    customer_id: str | None = None
    opportunity_id: str | None = None
    total_amount: Decimal | None = None
    state: SalesOrderState
    created_on: datetime | None = None
    modified_on: datetime | None = None


class SalesOrderLineCreate(BaseModel):
    product_id: str = Field(..., description="Product (SKU) GUID")
    quantity: Decimal = Field(..., gt=0)
    price_per_unit: Decimal = Field(..., ge=0)
    unit_id: str = Field(..., description="UoM GUID matching the product's unit schedule")


class SalesOrderLine(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    order_id: str
    product_id: str | None = None
    product_name: str | None = None
    quantity: Decimal
    price_per_unit: Decimal
    extended_amount: Decimal | None = None
    unit_id: str | None = None


SALESORDER_SELECT = ",".join([
    "salesorderid",
    "name",
    "description",
    "ordernumber",
    "totalamount",
    "statecode",
    "_customerid_value",
    "_opportunityid_value",
    "createdon",
    "modifiedon",
])

SALESORDERDETAIL_SELECT = ",".join([
    "salesorderdetailid",
    "_salesorderid_value",
    "_productid_value",
    "productname",
    "quantity",
    "priceperunit",
    "extendedamount",
    "_uomid_value",
])


def salesorder_from_dataverse(row: dict[str, Any]) -> SalesOrder:
    return SalesOrder(
        id=row["salesorderid"],
        name=row.get("name") or "",
        description=row.get("description"),
        order_number=row.get("ordernumber"),
        customer_id=row.get("_customerid_value"),
        opportunity_id=row.get("_opportunityid_value"),
        total_amount=(
            Decimal(str(row["totalamount"])) if row.get("totalamount") is not None else None
        ),
        state=SalesOrderState(row.get("statecode", SalesOrderState.active.value)),
        created_on=row.get("createdon"),
        modified_on=row.get("modifiedon"),
    )


def salesorder_line_from_dataverse(row: dict[str, Any]) -> SalesOrderLine:
    return SalesOrderLine(
        id=row["salesorderdetailid"],
        order_id=row.get("_salesorderid_value") or "",
        product_id=row.get("_productid_value"),
        product_name=row.get("productname"),
        quantity=Decimal(str(row.get("quantity") or 0)),
        price_per_unit=Decimal(str(row.get("priceperunit") or 0)),
        extended_amount=(
            Decimal(str(row["extendedamount"])) if row.get("extendedamount") is not None else None
        ),
        unit_id=row.get("_uomid_value"),
    )


def salesorder_create_to_dataverse(data: SalesOrderCreate) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "name": data.name,
        "customerid_account@odata.bind": f"/accounts({data.customer_id})",
    }
    if data.description is not None:
        payload["description"] = data.description
    if data.opportunity_id is not None:
        payload["opportunityid@odata.bind"] = f"/opportunities({data.opportunity_id})"
    return payload


def salesorder_update_to_dataverse(data: SalesOrderUpdate) -> dict[str, Any]:
    payload: dict[str, Any] = {}
    if data.name is not None:
        payload["name"] = data.name
    if data.description is not None:
        payload["description"] = data.description
    return payload


def salesorder_line_create_to_dataverse(order_id: str, data: SalesOrderLineCreate) -> dict[str, Any]:
    return {
        "salesorderid@odata.bind": f"/salesorders({order_id})",
        "productid@odata.bind": f"/products({data.product_id})",
        "uomid@odata.bind": f"/uoms({data.unit_id})",
        "quantity": float(data.quantity),
        "priceperunit": float(data.price_per_unit),
        "ispriceoverridden": True,
    }
