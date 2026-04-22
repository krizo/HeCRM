from datetime import date, datetime
from decimal import Decimal
from enum import IntEnum, StrEnum
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class OpportunityStage(StrEnum):
    prospecting = "prospecting"
    developing = "developing"
    proposing = "proposing"
    closing = "closing"
    won = "won"
    lost = "lost"


class _SalesStage(IntEnum):
    """Dataverse `opportunity.salesstage` option-set values (built-in)."""

    qualify = 0
    develop = 1
    propose = 2
    close = 3


class _StateCode(IntEnum):
    """Dataverse `opportunity.statecode` — 0=Open, 1=Won, 2=Lost."""

    open = 0
    won = 1
    lost = 2


_OPEN_STAGE_TO_SALES_STAGE: dict[OpportunityStage, _SalesStage] = {
    OpportunityStage.prospecting: _SalesStage.qualify,
    OpportunityStage.developing: _SalesStage.develop,
    OpportunityStage.proposing: _SalesStage.propose,
    OpportunityStage.closing: _SalesStage.close,
}

_SALES_STAGE_TO_OPEN_STAGE: dict[int, OpportunityStage] = {
    _SalesStage.qualify.value: OpportunityStage.prospecting,
    _SalesStage.develop.value: OpportunityStage.developing,
    _SalesStage.propose.value: OpportunityStage.proposing,
    _SalesStage.close.value: OpportunityStage.closing,
}


class OpportunityBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=300)
    description: str | None = Field(default=None, max_length=2000)
    estimated_value: Decimal | None = None
    estimated_close_date: date | None = None
    stage: OpportunityStage = OpportunityStage.prospecting


class OpportunityCreate(OpportunityBase):
    customer_id: str = Field(..., description="Account GUID (usually a distributor)")


class OpportunityUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=300)
    description: str | None = Field(default=None, max_length=2000)
    estimated_value: Decimal | None = None
    estimated_close_date: date | None = None
    stage: OpportunityStage | None = None


class OpportunityCloseRequest(BaseModel):
    """Body for POST /opportunities/{id}/win|lose."""

    subject: str = Field(default="Closed via HeCRM", max_length=200)


class Opportunity(OpportunityBase):
    model_config = ConfigDict(from_attributes=True)
    id: str
    customer_id: str | None = None
    created_on: datetime | None = None
    modified_on: datetime | None = None


OPPORTUNITY_SELECT = ",".join([
    "opportunityid",
    "name",
    "description",
    "estimatedvalue",
    "estimatedclosedate",
    "salesstage",
    "statecode",
    "_customerid_value",
    "createdon",
    "modifiedon",
])


def opportunity_from_dataverse(row: dict[str, Any]) -> Opportunity:
    state = row.get("statecode", _StateCode.open.value)
    if state == _StateCode.won.value:
        stage = OpportunityStage.won
    elif state == _StateCode.lost.value:
        stage = OpportunityStage.lost
    else:
        stage = _SALES_STAGE_TO_OPEN_STAGE.get(
            row.get("salesstage", _SalesStage.qualify.value),
            OpportunityStage.prospecting,
        )

    return Opportunity(
        id=row["opportunityid"],
        name=row.get("name") or "",
        description=row.get("description"),
        estimated_value=(
            Decimal(str(row["estimatedvalue"])) if row.get("estimatedvalue") is not None else None
        ),
        estimated_close_date=row.get("estimatedclosedate"),
        stage=stage,
        customer_id=row.get("_customerid_value"),
        created_on=row.get("createdon"),
        modified_on=row.get("modifiedon"),
    )


def _apply_shared_fields(payload: dict[str, Any], data: OpportunityBase | OpportunityUpdate) -> None:
    if data.name is not None:
        payload["name"] = data.name
    if data.description is not None:
        payload["description"] = data.description
    if data.estimated_value is not None:
        payload["estimatedvalue"] = float(data.estimated_value)
    if data.estimated_close_date is not None:
        payload["estimatedclosedate"] = data.estimated_close_date.isoformat()
    if data.stage is not None and data.stage in _OPEN_STAGE_TO_SALES_STAGE:
        payload["salesstage"] = _OPEN_STAGE_TO_SALES_STAGE[data.stage].value


def opportunity_create_to_dataverse(data: OpportunityCreate) -> dict[str, Any]:
    if data.stage in (OpportunityStage.won, OpportunityStage.lost):
        raise ValueError(
            "Cannot create an opportunity in a closed state — use POST /{id}/win or /{id}/lose."
        )
    payload: dict[str, Any] = {
        "customerid_account@odata.bind": f"/accounts({data.customer_id})",
    }
    _apply_shared_fields(payload, data)
    return payload


def opportunity_update_to_dataverse(data: OpportunityUpdate) -> dict[str, Any]:
    if data.stage in (OpportunityStage.won, OpportunityStage.lost):
        raise ValueError(
            "Cannot close an opportunity via PATCH — use POST /{id}/win or /{id}/lose."
        )
    payload: dict[str, Any] = {}
    _apply_shared_fields(payload, data)
    return payload
