from typing import Any

from fastapi import APIRouter, HTTPException, Query, status

from app.dependencies import DataverseClientDep
from app.dynamics.errors import DataverseError
from app.schemas.opportunity import (
    OPPORTUNITY_SELECT,
    Opportunity,
    OpportunityCloseRequest,
    OpportunityCreate,
    OpportunityStage,
    OpportunityUpdate,
    opportunity_create_to_dataverse,
    opportunity_from_dataverse,
    opportunity_update_to_dataverse,
)

router = APIRouter(prefix="/opportunities", tags=["opportunities"])


_STAGE_FILTER_MAP: dict[OpportunityStage, str] = {
    OpportunityStage.prospecting: "statecode eq 0 and salesstage eq 0",
    OpportunityStage.developing:  "statecode eq 0 and salesstage eq 1",
    OpportunityStage.proposing:   "statecode eq 0 and salesstage eq 2",
    OpportunityStage.closing:     "statecode eq 0 and salesstage eq 3",
    OpportunityStage.won:         "statecode eq 1",
    OpportunityStage.lost:        "statecode eq 2",
}


@router.get("", response_model=list[Opportunity], summary="List opportunities")
async def list_opportunities(
    client: DataverseClientDep,
    top: int = Query(default=50, ge=1, le=5000),
    customer_id: str | None = Query(default=None),
    stage: OpportunityStage | None = Query(default=None),
    open_only: bool = Query(default=False, description="Shortcut: only non-closed opportunities"),
) -> list[Opportunity]:
    params: dict[str, Any] = {
        "$select": OPPORTUNITY_SELECT,
        "$top": top,
        "$orderby": "modifiedon desc",
    }
    filters: list[str] = []
    if customer_id:
        filters.append(f"_customerid_value eq {customer_id}")
    if stage is not None:
        filters.append(f"({_STAGE_FILTER_MAP[stage]})")
    elif open_only:
        filters.append("statecode eq 0")
    if filters:
        params["$filter"] = " and ".join(filters)
    data = await client.get("/opportunities", params=params)
    return [opportunity_from_dataverse(row) for row in data.get("value", [])]


@router.get("/{opportunity_id}", response_model=Opportunity, summary="Get opportunity by id")
async def get_opportunity(opportunity_id: str, client: DataverseClientDep) -> Opportunity:
    try:
        row = await client.get(
            f"/opportunities({opportunity_id})",
            params={"$select": OPPORTUNITY_SELECT},
        )
    except DataverseError as exc:
        if exc.status_code == 404:
            raise HTTPException(
                status_code=404, detail=f"Opportunity {opportunity_id} not found"
            ) from exc
        raise
    return opportunity_from_dataverse(row)


@router.post(
    "",
    response_model=Opportunity,
    status_code=status.HTTP_201_CREATED,
    summary="Create opportunity",
)
async def create_opportunity(data: OpportunityCreate, client: DataverseClientDep) -> Opportunity:
    try:
        payload = opportunity_create_to_dataverse(data)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    row = await client.post("/opportunities", json=payload)
    return opportunity_from_dataverse(row)


@router.patch("/{opportunity_id}", response_model=Opportunity, summary="Update opportunity")
async def update_opportunity(
    opportunity_id: str,
    data: OpportunityUpdate,
    client: DataverseClientDep,
) -> Opportunity:
    try:
        payload = opportunity_update_to_dataverse(data)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    if not payload:
        raise HTTPException(status_code=400, detail="At least one field must be provided")
    try:
        row = await client.patch(f"/opportunities({opportunity_id})", json=payload)
    except DataverseError as exc:
        if exc.status_code == 404:
            raise HTTPException(
                status_code=404, detail=f"Opportunity {opportunity_id} not found"
            ) from exc
        raise
    return opportunity_from_dataverse(row)


@router.post(
    "/{opportunity_id}/win",
    response_model=Opportunity,
    summary="Close opportunity as Won (invokes Dataverse WinOpportunity action)",
)
async def win_opportunity(
    opportunity_id: str,
    body: OpportunityCloseRequest,
    client: DataverseClientDep,
) -> Opportunity:
    await _close_opportunity(
        client, opportunity_id, action="WinOpportunity", status_code=3, subject=body.subject
    )
    row = await client.get(
        f"/opportunities({opportunity_id})", params={"$select": OPPORTUNITY_SELECT}
    )
    return opportunity_from_dataverse(row)


@router.post(
    "/{opportunity_id}/lose",
    response_model=Opportunity,
    summary="Close opportunity as Lost (invokes Dataverse LoseOpportunity action)",
)
async def lose_opportunity(
    opportunity_id: str,
    body: OpportunityCloseRequest,
    client: DataverseClientDep,
) -> Opportunity:
    await _close_opportunity(
        client, opportunity_id, action="LoseOpportunity", status_code=4, subject=body.subject
    )
    row = await client.get(
        f"/opportunities({opportunity_id})", params={"$select": OPPORTUNITY_SELECT}
    )
    return opportunity_from_dataverse(row)


async def _close_opportunity(
    client, opportunity_id: str, *, action: str, status_code: int, subject: str
) -> None:
    body = {
        "Status": status_code,
        "OpportunityClose": {
            "subject": subject,
            "opportunityid@odata.bind": f"/opportunities({opportunity_id})",
        },
    }
    try:
        await client.post(f"/{action}", json=body)
    except DataverseError as exc:
        if exc.status_code == 404:
            raise HTTPException(
                status_code=404, detail=f"Opportunity {opportunity_id} not found"
            ) from exc
        raise


@router.delete(
    "/{opportunity_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete opportunity",
)
async def delete_opportunity(opportunity_id: str, client: DataverseClientDep) -> None:
    try:
        await client.delete(f"/opportunities({opportunity_id})")
    except DataverseError as exc:
        if exc.status_code == 404:
            raise HTTPException(
                status_code=404, detail=f"Opportunity {opportunity_id} not found"
            ) from exc
        raise
