# HeCRM ↔ Microsoft Dynamics 365 (Dataverse) Integration

This document walks through how HeCRM's FastAPI backend talks to Dynamics 365.
If you only care about *business* behaviour, see
[SALES_PROCESS.md](SALES_PROCESS.md). This one is the plumbing.

## 30-second overview

```
 React frontend  ─HTTPS JSON─▶  FastAPI (HeCRM)
                                    │
                                    ├─ OAuth2 token request ──▶  Entra ID
                                    │                            (login.microsoftonline.com)
                                    │
                                    └─ OData/REST with Bearer ─▶  Dataverse Web API
                                                                   (orgXXX.crm.dynamics.com)
```

- FastAPI is the only thing with Dataverse credentials.
- It acts as an **Application User** inside the environment — a seatless
  identity linked to an Entra ID app registration.
- Every call carries a short-lived bearer token obtained through the
  OAuth2 **client credentials** (server-to-server) flow.

## Authentication

### Client credentials flow

We use `msal.ConfidentialClientApplication` from the official Microsoft
Authentication Library. The request it makes under the hood:

```
POST https://login.microsoftonline.com/{AZURE_TENANT_ID}/oauth2/v2.0/token
Content-Type: application/x-www-form-urlencoded

grant_type=client_credentials
client_id={AZURE_CLIENT_ID}
client_secret={AZURE_CLIENT_SECRET}
scope=https://{dataverse_host}/.default
```

Response:

```json
{
  "access_token": "eyJ0eXAi…",
  "token_type": "Bearer",
  "expires_in": 3599
}
```

The `.default` scope is Dataverse's special "give me everything this app
registration is allowed" scope — more robust than listing specific
permissions.

### Token lifecycle

Implementation in [`backend/app/dynamics/auth.py`](../backend/app/dynamics/auth.py):

- **Lazy init.** MSAL's `ConfidentialClientApplication` hits the internet
  on construction to fetch OIDC discovery. We defer that to the first
  token request so the FastAPI app starts instantly (and so unit-test
  environments with dummy creds don't explode).
- **In-memory cache** keyed by `access_token`. The token is refreshed
  when `now > expires_at − 60s` (a 60-second leeway avoids race
  conditions where a token is still valid at check time but has expired
  by the time it reaches Dataverse).
- **Thread-safe** via a `threading.Lock`. The async code calls the
  synchronous MSAL layer via `asyncio.to_thread` so the event loop isn't
  blocked on token refreshes.

### Application User (the other half)

The app registration gives you an identity in *Entra ID*. Dataverse still
wants to know what that identity is allowed to do *inside the
environment*. So you also create an **Application User** there, linked
back to the app registration by its client ID, and assign it a security
role (we use System Administrator for development).

This is the step that most often trips up first-time integrators —
without it, every Dataverse call returns:

```
403 Forbidden
code=0x80072560 message="The user is not a member of the organization."
```

See [top-level README §5](../README.md#5-create-an-application-user-in-dataverse)
for the Power Platform Admin Center walkthrough.

## HTTP surface

[`backend/app/dynamics/client.py`](../backend/app/dynamics/client.py) wraps
`httpx.AsyncClient` with the base URL fixed to:

```
{DATAVERSE_URL}/api/data/v9.2
```

Every request carries the same headers:

| Header               | Value                          | Why                                    |
|----------------------|--------------------------------|----------------------------------------|
| `Authorization`      | `Bearer {token}`               | app-only token from MSAL               |
| `Accept`             | `application/json`             | we never parse XML                     |
| `OData-MaxVersion`   | `4.0`                          | mandatory per Dataverse spec           |
| `OData-Version`      | `4.0`                          | mandatory per Dataverse spec           |

POST / PATCH additionally send:

| Header          | Value                    | Effect                                                                |
|-----------------|--------------------------|-----------------------------------------------------------------------|
| `Content-Type`  | `application/json`       | send structured body                                                  |
| `Prefer`        | `return=representation`  | response includes the created/updated entity, not just a URL          |
| `If-Match` (PATCH) | `*`                   | bypass ETag optimistic-concurrency check (fine for demo)              |

Non-2xx responses are normalized through [`DataverseError`](../backend/app/dynamics/errors.py),
which extracts `error.code` + `error.message` from the OData error
envelope and re-raises. The FastAPI layer has a handler that maps
`DataverseError.status_code` back to HTTP for the caller.

## OData / Web API patterns we use

### Read with query options

```
GET /accounts
    ?$select=accountid,name,customertypecode
    &$filter=customertypecode eq 9
    &$top=50
    &$orderby=modifiedon desc
```

Always include `$select` — Dataverse returns every column by default,
which can be dozens of KB per row on `account`.

### Single-valued navigation properties

Looking up the parent of an account, reading vs writing:

- **Read**: Dataverse returns the parent's GUID under `_parentaccountid_value`
  (the leading underscore + `_value` suffix is the OData convention for
  navigation property IDs).
- **Write**: use the `@odata.bind` binding syntax on the *original* name:

```json
POST /accounts
{
  "name": "Pub Pod Dębami",
  "customertypecode": 3,
  "parentaccountid@odata.bind": "/accounts(9a64…)"
}
```

### "Customer" polymorphic fields

Some fields (`contact.parentcustomerid`, `opportunity.customerid`,
`salesorder.customerid`) are of type *Customer* — at runtime they
reference **either** an `account` **or** a `contact`. On write, you must
disambiguate by suffixing the binding key:

```json
"parentcustomerid_account@odata.bind": "/accounts(…)"
"customerid_account@odata.bind":       "/accounts(…)"
```

HeCRM always uses the account flavour.

### Unbound actions (Win / Lose opportunity)

`statecode` on an opportunity can't simply be PATCHed to Won or Lost —
those are privileged state transitions. Dataverse exposes them as
**unbound OData actions**:

```
POST /WinOpportunity
Content-Type: application/json

{
  "Status": 3,
  "OpportunityClose": {
    "subject": "Won via HeCRM",
    "opportunityid@odata.bind": "/opportunities(…)"
  }
}
```

- Status 3 → Won (the only legal value for this action)
- Status 4 → Lost/Canceled (for `LoseOpportunity`)

`OpportunityClose` is itself an entity (an activity record capturing the
reason the opportunity was closed). We keep it minimal — just a subject.

HeCRM wraps both as POST endpoints:

- `POST /api/opportunities/{id}/win`
- `POST /api/opportunities/{id}/lose`

## Schema mapping — Pydantic ↔ Dataverse

Each entity schema in `backend/app/schemas/` exposes three functions:

1. `{entity}_from_dataverse(row: dict)` — build our Pydantic model from a
   raw OData response row.
2. `{entity}_create_to_dataverse(data)` — build a POST body from
   `{Entity}Create`.
3. `{entity}_update_to_dataverse(data)` — build a PATCH body from
   `{Entity}Update` (only sends fields the client actually provided,
   avoiding accidental nulling-out).

### Example: `Account` ↔ `account`

| HeCRM field          | Dataverse field                     | Notes                                                  |
|----------------------|-------------------------------------|--------------------------------------------------------|
| `id`                 | `accountid`                         | GUID (read-only on write)                              |
| `name`               | `name`                              |                                                        |
| `account_number`     | `accountnumber`                     | Max 20 chars (!)                                       |
| `customer_type`      | `customertypecode`                  | Option-set: 3=Customer (retail), 9=Reseller (distributor) |
| `email`              | `emailaddress1`                     |                                                        |
| `phone`              | `telephone1`                        |                                                        |
| `website`            | `websiteurl`                        |                                                        |
| `city`               | `address1_city`                     |                                                        |
| `country`            | `address1_country`                  |                                                        |
| `parent_account_id`  | `_parentaccountid_value` (read) / `parentaccountid@odata.bind` (write) | N:1 to self        |
| `created_on`         | `createdon`                         | system field                                           |
| `modified_on`        | `modifiedon`                        | system field                                           |

The mapping files per entity:

| Backend schema file                       | Dataverse entity    |
|-------------------------------------------|---------------------|
| `backend/app/schemas/account.py`          | `account`           |
| `backend/app/schemas/contact.py`          | `contact`           |
| `backend/app/schemas/product.py`          | `product`           |
| `backend/app/schemas/opportunity.py`      | `opportunity`       |
| `backend/app/schemas/salesorder.py`       | `salesorder` + `salesorderdetail` |

## State machines

Many Dataverse entities carry two lifecycle fields:

- **`statecode`** — high-level state (enum).
- **`statuscode`** — granular reason inside a state (enum).

Examples:

| Entity        | statecode values                          | Notes                                                  |
|---------------|-------------------------------------------|--------------------------------------------------------|
| `opportunity` | 0=Open, 1=Won, 2=Lost                     | Transitions via WinOpportunity / LoseOpportunity action |
| `product`     | 0=Active, 1=Retired, 2=Draft, 3=Under Revision | New products land in Draft; HeCRM's `/activate` endpoint flips statecode→0, statuscode→1 |
| `salesorder`  | 0=Active, 1=Submitted, 2=Canceled, 3=Fulfilled, 4=Invoiced | Read-only from HeCRM for now |

Our Pydantic schemas expose `state: IntEnum` for the relevant entities so
API consumers see meaningful labels, not magic numbers.

## Units of measure

`product` requires two UoM references to be created:

- `defaultuomid` — the primary unit (e.g. "Primary Unit")
- `defaultuomscheduleid` — the schedule the unit belongs to

And `salesorderdetail` requires `uomid` matching the product's schedule.

Dataverse environments ship with a default schedule and a primary unit.
`backend/scripts/seed.py` looks them up once via `/uomschedules` + `/uoms`
and reuses the GUIDs for every product. The public API exposes
`GET /api/products/units` as a helper for clients that want to pick
their own unit.

## Gotchas we hit (and how to avoid them)

1. **MSAL hits the network on init.** We defer the `ConfidentialClientApplication`
   construction until the first token request. Otherwise a boot-time DNS
   failure kills the whole process, and test suites with dummy creds
   also fail at import time.
2. **`accountnumber` is capped at 20 characters.** Easy to exceed if you
   base it on `Date.now().toString()` + a prefix — Dataverse responds
   with a generic 422 that doesn't say which field.
3. **Customer-type `@odata.bind` needs the `_account` (or `_contact`) suffix**
   on the binding key, or you get a cryptic "entityType can't be inferred".
4. **`statecode` transitions for opportunities are not PATCHable** — use
   the dedicated `WinOpportunity` / `LoseOpportunity` action endpoints.
5. **Deleting an Active product** may fail if there are references (won
   opportunities, order lines). Flip to Retired first, or clean up the
   references.
6. **Application User ≠ App registration.** These are two separate
   objects in two separate admin centers. You must create both and link
   them via the client ID.
7. **`crm.dynamics.com` vs `crm4.dynamics.com`.** Dataverse picks a
   regional subdomain automatically — EU environments land on `crm4`,
   Americas on `crm`, APJ on `crm5`. Always take the exact URL from the
   Power Platform admin centre.

## Further reading

- [Dataverse Web API reference](https://learn.microsoft.com/power-apps/developer/data-platform/webapi/)
- [Use Web API actions](https://learn.microsoft.com/power-apps/developer/data-platform/webapi/use-web-api-actions)
- [Dataverse entity reference](https://learn.microsoft.com/dynamics365/customer-engagement/developer/about-entity-reference)
- [MSAL for Python — client credentials](https://learn.microsoft.com/azure/active-directory/develop/msal-authentication-flows#client-credentials)
