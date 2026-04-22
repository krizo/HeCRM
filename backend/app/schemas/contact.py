from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class ContactBase(BaseModel):
    first_name: str = Field(..., min_length=1, max_length=80)
    last_name: str = Field(..., min_length=1, max_length=80)
    job_title: str | None = Field(default=None, max_length=100)
    email: str | None = Field(default=None, max_length=100)
    phone: str | None = Field(default=None, max_length=50)
    mobile: str | None = Field(default=None, max_length=50)
    city: str | None = Field(default=None, max_length=80)
    country: str | None = Field(default=None, max_length=80)


class ContactCreate(ContactBase):
    account_id: str = Field(..., description="Parent account (distributor or retail) GUID")


class ContactUpdate(BaseModel):
    first_name: str | None = Field(default=None, min_length=1, max_length=80)
    last_name: str | None = Field(default=None, min_length=1, max_length=80)
    job_title: str | None = Field(default=None, max_length=100)
    email: str | None = Field(default=None, max_length=100)
    phone: str | None = Field(default=None, max_length=50)
    mobile: str | None = Field(default=None, max_length=50)
    city: str | None = Field(default=None, max_length=80)
    country: str | None = Field(default=None, max_length=80)
    account_id: str | None = None


class Contact(ContactBase):
    model_config = ConfigDict(from_attributes=True)
    id: str
    full_name: str | None = None
    account_id: str | None = None
    created_on: datetime | None = None
    modified_on: datetime | None = None


CONTACT_SELECT = ",".join([
    "contactid",
    "firstname",
    "lastname",
    "fullname",
    "jobtitle",
    "emailaddress1",
    "telephone1",
    "mobilephone",
    "address1_city",
    "address1_country",
    "_parentcustomerid_value",
    "createdon",
    "modifiedon",
])


def contact_from_dataverse(row: dict[str, Any]) -> Contact:
    return Contact(
        id=row["contactid"],
        first_name=row.get("firstname") or "",
        last_name=row.get("lastname") or "",
        full_name=row.get("fullname"),
        job_title=row.get("jobtitle"),
        email=row.get("emailaddress1"),
        phone=row.get("telephone1"),
        mobile=row.get("mobilephone"),
        city=row.get("address1_city"),
        country=row.get("address1_country"),
        account_id=row.get("_parentcustomerid_value"),
        created_on=row.get("createdon"),
        modified_on=row.get("modifiedon"),
    )


def _apply_shared_fields(payload: dict[str, Any], data: ContactBase | ContactUpdate) -> None:
    if data.job_title is not None:
        payload["jobtitle"] = data.job_title
    if data.email is not None:
        payload["emailaddress1"] = data.email
    if data.phone is not None:
        payload["telephone1"] = data.phone
    if data.mobile is not None:
        payload["mobilephone"] = data.mobile
    if data.city is not None:
        payload["address1_city"] = data.city
    if data.country is not None:
        payload["address1_country"] = data.country


def contact_create_to_dataverse(data: ContactCreate) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "firstname": data.first_name,
        "lastname": data.last_name,
        "parentcustomerid_account@odata.bind": f"/accounts({data.account_id})",
    }
    _apply_shared_fields(payload, data)
    return payload


def contact_update_to_dataverse(data: ContactUpdate) -> dict[str, Any]:
    payload: dict[str, Any] = {}
    if data.first_name is not None:
        payload["firstname"] = data.first_name
    if data.last_name is not None:
        payload["lastname"] = data.last_name
    _apply_shared_fields(payload, data)
    if data.account_id is not None:
        payload["parentcustomerid_account@odata.bind"] = f"/accounts({data.account_id})"
    return payload
