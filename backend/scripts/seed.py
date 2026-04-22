"""Seed HeCRM demo data into a fresh Dataverse environment.

Populates the graph described in docs/SALES_PROCESS.md:
  - 3 distributors + 6 retail accounts (parent-linked)
  - 1 contact per account
  - 6 beer SKUs (created Draft, then activated)
  - 4 opportunities (open, won, lost) spanning different stages
  - 1 sales order (materialization of the won opportunity) with 3 line items

Usage (from `backend/`):
    python -m scripts.seed                 # seed (idempotency = manual — run --reset first if re-running)
    python -m scripts.seed --reset         # nuke HeCRM-tagged data and re-seed
    python -m scripts.seed --reset-only    # nuke without re-seeding

Every record HeCRM creates is tagged so reset can find it:
  - accounts     by `accountnumber` starting with `HECRM-`
  - contacts     by their parent account
  - products     by `productnumber` starting with `HCR-`
  - opportunities/salesorders via `_customerid_value` of HeCRM accounts
"""

from __future__ import annotations

import argparse
import asyncio
import sys
from dataclasses import dataclass, field
from decimal import Decimal
from typing import Any

from app.config import get_settings
from app.dynamics.auth import DataverseTokenProvider
from app.dynamics.client import DataverseClient
from app.dynamics.errors import DataverseError

# ---------------------------------------------------------------------------
# Data definitions
# ---------------------------------------------------------------------------

ACCOUNT_PREFIX = "HECRM-"
PRODUCT_PREFIX = "HCR-"


@dataclass
class DistributorSpec:
    number: str
    name: str
    city: str
    phone: str
    website: str


@dataclass
class RetailSpec:
    number: str
    name: str
    city: str
    phone: str
    distributor_number: str


@dataclass
class ContactSpec:
    first_name: str
    last_name: str
    job_title: str
    account_number: str
    email: str | None = None
    phone: str | None = None


@dataclass
class ProductSpec:
    number: str
    name: str
    description: str
    price: Decimal
    cost: Decimal


@dataclass
class OpportunitySpec:
    name: str
    customer_account_number: str
    estimated_value: Decimal
    stage: str                  # our enum value — prospecting/developing/proposing/closing/won/lost
    description: str = ""
    sku_lines: list[tuple[str, int, Decimal]] = field(default_factory=list)  # (product_number, qty, price)


DISTRIBUTORS: list[DistributorSpec] = [
    DistributorSpec(
        number=f"{ACCOUNT_PREFIX}D-001",
        name="Beverage Supply Polska Sp. z o.o.",
        city="Warszawa",
        phone="+48 22 555 0101",
        website="https://bevsupply.example.pl",
    ),
    DistributorSpec(
        number=f"{ACCOUNT_PREFIX}D-002",
        name="Hurt Piwny Południe",
        city="Katowice",
        phone="+48 32 555 0202",
        website="https://hurt-piwny.example.pl",
    ),
    DistributorSpec(
        number=f"{ACCOUNT_PREFIX}D-003",
        name="Baltic Drinks Distribution",
        city="Gdańsk",
        phone="+48 58 555 0303",
        website="https://balticdrinks.example.pl",
    ),
]

RETAIL: list[RetailSpec] = [
    RetailSpec(f"{ACCOUNT_PREFIX}R-001", "Pub Pod Dębami", "Warszawa",
               "+48 22 555 1001", f"{ACCOUNT_PREFIX}D-001"),
    RetailSpec(f"{ACCOUNT_PREFIX}R-002", "The British Bulldog", "Warszawa",
               "+48 22 555 1002", f"{ACCOUNT_PREFIX}D-001"),
    RetailSpec(f"{ACCOUNT_PREFIX}R-003", "Restauracja Stary Młyn", "Kraków",
               "+48 12 555 1003", f"{ACCOUNT_PREFIX}D-002"),
    RetailSpec(f"{ACCOUNT_PREFIX}R-004", "Piwobranie – sklep monopolowy", "Katowice",
               "+48 32 555 1004", f"{ACCOUNT_PREFIX}D-002"),
    RetailSpec(f"{ACCOUNT_PREFIX}R-005", "Bar Nocny Rejs", "Gdańsk",
               "+48 58 555 1005", f"{ACCOUNT_PREFIX}D-003"),
    RetailSpec(f"{ACCOUNT_PREFIX}R-006", "Restauracja Bałtyk", "Sopot",
               "+48 58 555 1006", f"{ACCOUNT_PREFIX}D-003"),
]

CONTACTS: list[ContactSpec] = [
    ContactSpec("Anna",     "Kowalczyk",  "Purchasing Manager",   f"{ACCOUNT_PREFIX}D-001",
                email="anna.kowalczyk@bevsupply.example.pl"),
    ContactSpec("Tomasz",   "Nowak",      "Head of Procurement",  f"{ACCOUNT_PREFIX}D-002",
                email="tomasz.nowak@hurt-piwny.example.pl"),
    ContactSpec("Magdalena","Wiśniewska", "Purchasing Director",  f"{ACCOUNT_PREFIX}D-003",
                email="m.wisniewska@balticdrinks.example.pl"),
    ContactSpec("Piotr",    "Zieliński",  "Owner",                f"{ACCOUNT_PREFIX}R-001"),
    ContactSpec("James",    "Carter",     "Manager",              f"{ACCOUNT_PREFIX}R-002"),
    ContactSpec("Katarzyna","Dąbrowska",  "Owner",                f"{ACCOUNT_PREFIX}R-003"),
    ContactSpec("Marek",    "Wójcik",     "Store Manager",        f"{ACCOUNT_PREFIX}R-004"),
    ContactSpec("Łukasz",   "Lewandowski","Bar Manager",          f"{ACCOUNT_PREFIX}R-005"),
    ContactSpec("Agnieszka","Kamińska",   "Restaurant Manager",   f"{ACCOUNT_PREFIX}R-006"),
]

PRODUCTS: list[ProductSpec] = [
    ProductSpec(f"{PRODUCT_PREFIX}LG-05-BTL",  "HeCRM Lager Premium 0.5L Bottle",
                "Classic pale lager, 4.8% ABV, 500 ml returnable bottle.",
                Decimal("5.20"), Decimal("3.10")),
    ProductSpec(f"{PRODUCT_PREFIX}LG-033-BTL", "HeCRM Lager Premium 0.33L Bottle",
                "Classic pale lager, 4.8% ABV, 330 ml bottle.",
                Decimal("3.80"), Decimal("2.20")),
    ProductSpec(f"{PRODUCT_PREFIX}IPA-05-CAN", "HeCRM IPA Crafted 0.5L Can",
                "New England IPA, 5.6% ABV, hop-forward.",
                Decimal("6.50"), Decimal("4.00")),
    ProductSpec(f"{PRODUCT_PREFIX}WZ-05-BTL",  "HeCRM Weizen 0.5L Bottle",
                "Bavarian-style wheat beer, 5.2% ABV.",
                Decimal("5.90"), Decimal("3.50")),
    ProductSpec(f"{PRODUCT_PREFIX}00-033-BTL", "HeCRM Zero 0.33L Bottle",
                "Non-alcoholic lager, 0.0% ABV.",
                Decimal("3.50"), Decimal("2.00")),
    ProductSpec(f"{PRODUCT_PREFIX}LG-30-KEG",  "HeCRM Lager Draft 30L Keg",
                "Draft lager for HoReCa, 4.8% ABV, 30 L keg.",
                Decimal("280.00"), Decimal("180.00")),
]

OPPORTUNITIES: list[OpportunitySpec] = [
    OpportunitySpec(
        name="Summer rollout 2026 — Baltic Drinks",
        customer_account_number=f"{ACCOUNT_PREFIX}D-003",
        estimated_value=Decimal("150000.00"),
        stage="proposing",
        description="Proposed regional rollout covering Pomorskie in summer 2026.",
    ),
    OpportunitySpec(
        name="Pilot IPA at Pod Dębami",
        customer_account_number=f"{ACCOUNT_PREFIX}R-001",
        estimated_value=Decimal("5000.00"),
        stage="developing",
        description="Pilot tap program for craft IPA during summer.",
    ),
    OpportunitySpec(
        name="Expansion deal — Hurt Piwny Q2",
        customer_account_number=f"{ACCOUNT_PREFIX}D-002",
        estimated_value=Decimal("82000.00"),
        stage="won",  # will be won + converted to salesorder
        description="Q2 wholesale expansion — volume commitment on lager range.",
        sku_lines=[
            (f"{PRODUCT_PREFIX}LG-05-BTL", 2000, Decimal("4.80")),
            (f"{PRODUCT_PREFIX}LG-30-KEG",   40, Decimal("260.00")),
            (f"{PRODUCT_PREFIX}IPA-05-CAN",  500, Decimal("6.00")),
        ],
    ),
    OpportunitySpec(
        name="Entry bid — Northwest region",
        customer_account_number=f"{ACCOUNT_PREFIX}D-001",
        estimated_value=Decimal("40000.00"),
        stage="lost",
        description="Pitched regional exclusivity; customer went with competitor.",
    ),
]


# ---------------------------------------------------------------------------
# Stage mappings (duplicated from schemas on purpose — seed stays standalone)
# ---------------------------------------------------------------------------

_OPEN_STAGE_TO_SALESSTAGE = {
    "prospecting": 0,
    "developing": 1,
    "proposing": 2,
    "closing": 3,
}


# ---------------------------------------------------------------------------
# Seeding primitives
# ---------------------------------------------------------------------------


async def _find_accounts_by_prefix(client: DataverseClient, prefix: str) -> list[dict[str, Any]]:
    data = await client.get(
        "/accounts",
        params={
            "$select": "accountid,name,accountnumber",
            "$filter": f"startswith(accountnumber, '{prefix}')",
            "$top": 200,
        },
    )
    return data.get("value", [])


async def _find_products_by_prefix(client: DataverseClient, prefix: str) -> list[dict[str, Any]]:
    data = await client.get(
        "/products",
        params={
            "$select": "productid,name,productnumber,statecode",
            "$filter": f"startswith(productnumber, '{prefix}')",
            "$top": 200,
        },
    )
    return data.get("value", [])


async def _get_default_uom(client: DataverseClient) -> tuple[str, str]:
    """Return (uomscheduleid, uomid) for the default unit schedule + its primary unit."""
    schedules = await client.get(
        "/uomschedules",
        params={"$select": "uomscheduleid,name", "$top": 5},
    )
    if not schedules.get("value"):
        raise RuntimeError("No UoM schedules found in this Dataverse environment.")
    schedule = schedules["value"][0]
    schedule_id = schedule["uomscheduleid"]
    units = await client.get(
        "/uoms",
        params={
            "$select": "uomid,name",
            "$filter": f"_uomscheduleid_value eq {schedule_id}",
            "$top": 5,
        },
    )
    if not units.get("value"):
        raise RuntimeError(f"No units under schedule {schedule['name']}.")
    return schedule_id, units["value"][0]["uomid"]


async def _reset(client: DataverseClient) -> None:
    print("[reset] Looking for existing HeCRM-tagged data…")

    accounts = await _find_accounts_by_prefix(client, ACCOUNT_PREFIX)
    account_ids = {a["accountid"] for a in accounts}
    print(f"[reset] {len(accounts)} HeCRM accounts found.")

    # 1. Sales order details under orders whose customer is ours
    # 2. Sales orders where customer is ours
    # 3. Opportunities where customer is ours
    # 4. Contacts where parent customer is ours
    # 5. Accounts
    # 6. Products with HCR- prefix

    for account_id in account_ids:
        # orders
        orders = await client.get(
            "/salesorders",
            params={
                "$select": "salesorderid",
                "$filter": f"_customerid_value eq {account_id}",
                "$top": 100,
            },
        )
        for order in orders.get("value", []):
            # details first
            lines = await client.get(
                "/salesorderdetails",
                params={
                    "$select": "salesorderdetailid",
                    "$filter": f"_salesorderid_value eq {order['salesorderid']}",
                    "$top": 100,
                },
            )
            for line in lines.get("value", []):
                await _safe_delete(
                    client, f"/salesorderdetails({line['salesorderdetailid']})", "salesorderdetail"
                )
            await _safe_delete(client, f"/salesorders({order['salesorderid']})", "salesorder")

        # opportunities
        opps = await client.get(
            "/opportunities",
            params={
                "$select": "opportunityid,statecode",
                "$filter": f"_customerid_value eq {account_id}",
                "$top": 100,
            },
        )
        for opp in opps.get("value", []):
            # closed opps may need to be reopened before delete on some envs; try direct first
            await _safe_delete(
                client, f"/opportunities({opp['opportunityid']})", "opportunity"
            )

        # contacts
        contacts = await client.get(
            "/contacts",
            params={
                "$select": "contactid",
                "$filter": f"_parentcustomerid_value eq {account_id}",
                "$top": 100,
            },
        )
        for c in contacts.get("value", []):
            await _safe_delete(client, f"/contacts({c['contactid']})", "contact")

    # retail accounts have parents — delete all accounts (parents may need to be last,
    # but Dataverse handles parentaccountid nullification automatically)
    for account_id in account_ids:
        await _safe_delete(client, f"/accounts({account_id})", "account")

    # products
    products = await _find_products_by_prefix(client, PRODUCT_PREFIX)
    print(f"[reset] {len(products)} HeCRM products found.")
    for p in products:
        # must retire first if active (you can't delete Active products directly in some configs);
        # try plain delete, fall back to PATCH to Draft then delete.
        ok = await _safe_delete(client, f"/products({p['productid']})", "product")
        if not ok:
            try:
                await client.patch(
                    f"/products({p['productid']})",
                    json={"statecode": 2, "statuscode": 1},  # Draft
                )
                await _safe_delete(client, f"/products({p['productid']})", "product (retry)")
            except DataverseError as exc:
                print(f"[reset]   product {p['name']}: {exc.message}")

    print("[reset] Done.\n")


async def _safe_delete(client: DataverseClient, path: str, label: str) -> bool:
    try:
        await client.delete(path)
        return True
    except DataverseError as exc:
        print(f"[reset]   {label} {path}: {exc.status_code} {exc.message}")
        return False


async def _seed(client: DataverseClient) -> None:
    print("[seed] Creating distributors…")
    distributor_id_by_number: dict[str, str] = {}
    for d in DISTRIBUTORS:
        created = await client.post(
            "/accounts",
            json={
                "name": d.name,
                "accountnumber": d.number,
                "customertypecode": 9,  # Reseller
                "telephone1": d.phone,
                "websiteurl": d.website,
                "address1_city": d.city,
                "address1_country": "Poland",
            },
        )
        distributor_id_by_number[d.number] = created["accountid"]
        print(f"  + {d.number}  {d.name}")

    print("[seed] Creating retail accounts…")
    retail_id_by_number: dict[str, str] = {}
    for r in RETAIL:
        parent_id = distributor_id_by_number[r.distributor_number]
        created = await client.post(
            "/accounts",
            json={
                "name": r.name,
                "accountnumber": r.number,
                "customertypecode": 3,  # Customer
                "telephone1": r.phone,
                "address1_city": r.city,
                "address1_country": "Poland",
                "parentaccountid@odata.bind": f"/accounts({parent_id})",
            },
        )
        retail_id_by_number[r.number] = created["accountid"]
        print(f"  + {r.number}  {r.name}  (parent={r.distributor_number})")

    all_account_ids = {**distributor_id_by_number, **retail_id_by_number}

    print("[seed] Creating contacts…")
    for c in CONTACTS:
        parent_id = all_account_ids[c.account_number]
        body = {
            "firstname": c.first_name,
            "lastname": c.last_name,
            "jobtitle": c.job_title,
            "parentcustomerid_account@odata.bind": f"/accounts({parent_id})",
        }
        if c.email:
            body["emailaddress1"] = c.email
        if c.phone:
            body["telephone1"] = c.phone
        await client.post("/contacts", json=body)
        print(f"  + {c.first_name} {c.last_name} ({c.job_title}) @ {c.account_number}")

    print("[seed] Resolving default UoM…")
    schedule_id, unit_id = await _get_default_uom(client)
    print(f"  schedule={schedule_id} unit={unit_id}")

    print("[seed] Creating products…")
    product_id_by_number: dict[str, str] = {}
    unit_id_by_product_number: dict[str, str] = {}
    for p in PRODUCTS:
        created = await client.post(
            "/products",
            json={
                "name": p.name,
                "productnumber": p.number,
                "description": p.description,
                "price": float(p.price),
                "currentcost": float(p.cost),
                "defaultuomid@odata.bind": f"/uoms({unit_id})",
                "defaultuomscheduleid@odata.bind": f"/uomschedules({schedule_id})",
            },
        )
        pid = created["productid"]
        product_id_by_number[p.number] = pid
        unit_id_by_product_number[p.number] = unit_id
        # activate (Draft → Active)
        await client.patch(
            f"/products({pid})",
            json={"statecode": 0, "statuscode": 1},
        )
        print(f"  + {p.number}  {p.name}")

    print("[seed] Creating opportunities…")
    opportunity_id_by_name: dict[str, str] = {}
    for opp in OPPORTUNITIES:
        customer_id = all_account_ids[opp.customer_account_number]
        # open stage to create with — terminal stages start as 'closing' and then get closed
        open_stage_key = opp.stage if opp.stage in _OPEN_STAGE_TO_SALESSTAGE else "closing"
        body = {
            "name": opp.name,
            "description": opp.description,
            "estimatedvalue": float(opp.estimated_value),
            "salesstage": _OPEN_STAGE_TO_SALESSTAGE[open_stage_key],
            "customerid_account@odata.bind": f"/accounts({customer_id})",
        }
        created = await client.post("/opportunities", json=body)
        opp_id = created["opportunityid"]
        opportunity_id_by_name[opp.name] = opp_id
        print(f"  + {opp.stage:11s} {opp.name}")

        if opp.stage == "won":
            await client.post(
                "/WinOpportunity",
                json={
                    "Status": 3,
                    "OpportunityClose": {
                        "subject": f"Won: {opp.name}",
                        "opportunityid@odata.bind": f"/opportunities({opp_id})",
                    },
                },
            )
            # materialize into a sales order
            order_name = f"Order — {opp.name}"
            order = await client.post(
                "/salesorders",
                json={
                    "name": order_name,
                    "description": f"Auto-created from won opportunity: {opp.name}",
                    "customerid_account@odata.bind": f"/accounts({customer_id})",
                    "opportunityid@odata.bind": f"/opportunities({opp_id})",
                },
            )
            order_id = order["salesorderid"]
            print(f"      → salesorder {order_id[:8]}… ({order_name})")
            for sku, qty, price in opp.sku_lines:
                pid = product_id_by_number[sku]
                await client.post(
                    "/salesorderdetails",
                    json={
                        "salesorderid@odata.bind": f"/salesorders({order_id})",
                        "productid@odata.bind": f"/products({pid})",
                        "uomid@odata.bind": f"/uoms({unit_id_by_product_number[sku]})",
                        "quantity": qty,
                        "priceperunit": float(price),
                        "ispriceoverridden": True,
                    },
                )
                print(f"        + line: {sku} × {qty} @ {price}")
        elif opp.stage == "lost":
            await client.post(
                "/LoseOpportunity",
                json={
                    "Status": 4,
                    "OpportunityClose": {
                        "subject": f"Lost: {opp.name}",
                        "opportunityid@odata.bind": f"/opportunities({opp_id})",
                    },
                },
            )

    print("\n[seed] Done. Summary:")
    print(f"  distributors : {len(distributor_id_by_number)}")
    print(f"  retail       : {len(retail_id_by_number)}")
    print(f"  contacts     : {len(CONTACTS)}")
    print(f"  products     : {len(product_id_by_number)}")
    print(f"  opportunities: {len(opportunity_id_by_name)}")


# ---------------------------------------------------------------------------
# Entrypoint
# ---------------------------------------------------------------------------


async def _main(reset: bool, reset_only: bool) -> int:
    settings = get_settings()
    token_provider = DataverseTokenProvider(settings)
    client = DataverseClient(settings, token_provider)
    try:
        if reset or reset_only:
            await _reset(client)
        if not reset_only:
            await _seed(client)
    except DataverseError as exc:
        print(f"\n[FAIL] Dataverse {exc.status_code} {exc.code}: {exc.message}", file=sys.stderr)
        return 1
    finally:
        await client.close()
    return 0


def main() -> None:
    parser = argparse.ArgumentParser(description="Seed HeCRM demo data into Dataverse.")
    parser.add_argument("--reset", action="store_true", help="Delete HeCRM-tagged data before seeding.")
    parser.add_argument("--reset-only", action="store_true", help="Delete HeCRM-tagged data and exit.")
    args = parser.parse_args()
    sys.exit(asyncio.run(_main(reset=args.reset, reset_only=args.reset_only)))


if __name__ == "__main__":
    main()
