from datetime import datetime
from enum import StrEnum
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class CustomerType(StrEnum):
    """HeCRM-level alias over Dataverse `account.customertypecode`."""

    retail = "retail"
    distributor = "distributor"


CUSTOMER_TYPE_TO_CODE: dict[CustomerType, int] = {
    CustomerType.retail: 3,       # OOB option: Customer
    CustomerType.distributor: 9,  # OOB option: Reseller
}

CODE_TO_CUSTOMER_TYPE: dict[int, CustomerType] = {v: k for k, v in CUSTOMER_TYPE_TO_CODE.items()}


class AccountBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=160)
    account_number: str | None = Field(default=None, max_length=20)
    customer_type: CustomerType
    email: str | None = Field(default=None, max_length=100)
    phone: str | None = Field(default=None, max_length=50)
    website: str | None = Field(default=None, max_length=200)
    city: str | None = Field(default=None, max_length=80)
    country: str | None = Field(default=None, max_length=80)


class AccountCreate(AccountBase):
    parent_account_id: str | None = Field(
        default=None,
        description="GUID of the parent distributor for a retail child account.",
    )


class AccountUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=160)
    account_number: str | None = Field(default=None, max_length=20)
    customer_type: CustomerType | None = None
    email: str | None = Field(default=None, max_length=100)
    phone: str | None = Field(default=None, max_length=50)
    website: str | None = Field(default=None, max_length=200)
    city: str | None = Field(default=None, max_length=80)
    country: str | None = Field(default=None, max_length=80)
    parent_account_id: str | None = None


class Account(AccountBase):
    model_config = ConfigDict(from_attributes=True)

    id: str
    parent_account_id: str | None = None
    created_on: datetime | None = None
    modified_on: datetime | None = None


_DATAVERSE_SELECT = [
    "accountid",
    "name",
    "accountnumber",
    "customertypecode",
    "emailaddress1",
    "telephone1",
    "websiteurl",
    "address1_city",
    "address1_country",
    "_parentaccountid_value",
    "createdon",
    "modifiedon",
]

ACCOUNT_SELECT = ",".join(_DATAVERSE_SELECT)


def account_from_dataverse(row: dict[str, Any]) -> Account:
    code = row.get("customertypecode")
    customer_type = CODE_TO_CUSTOMER_TYPE.get(code) if code is not None else CustomerType.retail
    return Account(
        id=row["accountid"],
        name=row.get("name") or "",
        account_number=row.get("accountnumber"),
        customer_type=customer_type or CustomerType.retail,
        email=row.get("emailaddress1"),
        phone=row.get("telephone1"),
        website=row.get("websiteurl"),
        city=row.get("address1_city"),
        country=row.get("address1_country"),
        parent_account_id=row.get("_parentaccountid_value"),
        created_on=row.get("createdon"),
        modified_on=row.get("modifiedon"),
    )


def _apply_shared_fields(payload: dict[str, Any], data: AccountBase | AccountUpdate) -> None:
    if data.account_number is not None:
        payload["accountnumber"] = data.account_number
    if data.email is not None:
        payload["emailaddress1"] = data.email
    if data.phone is not None:
        payload["telephone1"] = data.phone
    if data.website is not None:
        payload["websiteurl"] = data.website
    if data.city is not None:
        payload["address1_city"] = data.city
    if data.country is not None:
        payload["address1_country"] = data.country


def account_create_to_dataverse(data: AccountCreate) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "name": data.name,
        "customertypecode": CUSTOMER_TYPE_TO_CODE[data.customer_type],
    }
    _apply_shared_fields(payload, data)
    if data.parent_account_id is not None:
        payload["parentaccountid@odata.bind"] = f"/accounts({data.parent_account_id})"
    return payload


def account_update_to_dataverse(data: AccountUpdate) -> dict[str, Any]:
    payload: dict[str, Any] = {}
    if data.name is not None:
        payload["name"] = data.name
    if data.customer_type is not None:
        payload["customertypecode"] = CUSTOMER_TYPE_TO_CODE[data.customer_type]
    _apply_shared_fields(payload, data)
    if data.parent_account_id is not None:
        payload["parentaccountid@odata.bind"] = f"/accounts({data.parent_account_id})"
    return payload
