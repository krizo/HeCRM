# HeCRM — Sales Process

This document is the **single source of truth** for HeCRM's fictional business
model. Everything in the codebase — entity shapes, API contracts, seed data,
and test fixtures — is derived from what's written here. If the narrative
changes, the code follows.

## The company

**HeCRM S.A.** is a fictional Polish brewer producing a small portfolio of
beers and non-alcoholic beverages. It does **not** sell directly to consumers.
Everything goes through a two-tier distribution network:

```
            ┌──────────────┐
            │   HeCRM S.A. │  ← the brewery (us)
            └──────┬───────┘
                   │ wholesale orders
          ┌────────┼────────┬────────────┐
          ▼        ▼        ▼            ▼
      ┌────────┐ ┌────────┐ ┌────────┐  … N distributors (regional)
      │Distrib.│ │Distrib.│ │Distrib.│
      └────┬───┘ └────┬───┘ └────┬───┘
           │          │          │
     ┌─────┼─────┐    …          …
     ▼     ▼     ▼
   [Bar] [Pub] [Shop]  ← retail accounts (HoReCa / off-trade)
```

- A **Distributor** is a regional wholesaler (e.g. "Beverage Supply Polska",
  covering Mazowieckie).
- A **Retail** account is a single venue: bar, pub, restaurant, off-license shop.
- Every retail account has **exactly one parent distributor** — this is the
  `account.parentaccountid` link in Dataverse.

## Entities (Dataverse ↔ HeCRM)

| HeCRM concept        | Dataverse entity | Customer-type code                          |
|----------------------|------------------|---------------------------------------------|
| Distributor          | `account`        | `customertypecode = 9`  (Reseller)          |
| Retail account       | `account`        | `customertypecode = 3`  (Customer)          |
| Contact person       | `contact`        | linked via `parentcustomerid` → account     |
| Product (beer SKU)   | `product`        | —                                           |
| Sales opportunity    | `opportunity`    | `customerid` → account (usually distributor)|
| Confirmed order      | `salesorder`     | `customerid` → account; optional `opportunityid` |
| Order line item      | `salesorderdetail` | `salesorderid` + `productid` + quantity   |

## The sales process

### 1. Prospecting
A rep spots a new potential customer — most often a **distributor** bidding
to cover a new region, sometimes a large **retail chain** that wants to pilot
our brands. A **Contact** is captured for the decision-maker.

Corresponding action: `POST /api/accounts` + `POST /api/contacts`.

### 2. Opportunity created
When the deal looks real, an **Opportunity** is opened against the account.
It carries an estimated value, expected close date, and a **stage** drawn from
Dataverse's built-in sales process (`opportunity.salesstage`):

| HeCRM stage      | Dataverse `salesstage` | Meaning                                     |
|------------------|------------------------|---------------------------------------------|
| `prospecting`    | `0` — Qualify          | First contact, identifying intent           |
| `developing`     | `1` — Develop          | Needs analysis, stakeholder mapping         |
| `proposing`      | `2` — Propose          | Quote issued, terms on the table            |
| `closing`        | `3` — Close            | Negotiating pricing, contract, volumes      |
| `won`            | *(closed)*             | Won via `WinOpportunity` action             |
| `lost`           | *(closed)*             | Lost via `LoseOpportunity` action           |

`won` / `lost` aren't set with a plain `PATCH` — Dataverse has dedicated actions:

- `POST /WinOpportunity` — body: `{ "Status": 3, "OpportunityClose": { ... } }`
- `POST /LoseOpportunity` — body: `{ "Status": 4, "OpportunityClose": { ... } }`

HeCRM exposes these as:

- `POST /api/opportunities/{id}/win`
- `POST /api/opportunities/{id}/lose`

### 3. Order
A won opportunity becomes a **SalesOrder**. Two flavors:

- **Distributor order** — periodic, high-volume. Paid on NET30 terms.
  `customerid` → distributor account. `opportunityid` → the original won opp.
- **Retail top-up order** — smaller, weekly. Placed by a distributor on behalf
  of one of its retail accounts, OR by the retail directly against its
  distributor. (In this demo the brewery sees the distributor-level order.)

An order carries one or more **line items** (`salesorderdetail`), each
referencing a **product** (SKU), quantity, and unit price.

HeCRM endpoints:

- `POST /api/salesorders`                 — create order header
- `GET  /api/salesorders[?customer_id=]`  — list
- `GET  /api/salesorders/{id}`            — single order
- `GET  /api/salesorders/{id}/lines`      — list line items
- `POST /api/salesorders/{id}/lines`      — add a line item

### 4. Fulfillment (out of scope for MVP)
Delivery, invoicing, cancelations live in Dataverse but we don't model them
in HeCRM yet. The order `statecode` still reflects them (`0` Active,
`1` Submitted, `2` Canceled, `3` Fulfilled, `4` Invoiced) for read-side only.

## The data model in one glance

```
 Account (Distributor)───┐
  ├── Contact (Buyer)    │  parentaccountid
  └── Opportunity ───┐   │
                     ├───┴──► Account (Retail, child of Distributor)
                     │          ├── Contact (Owner / Manager)
                     │          └── SalesOrder ───► SalesOrderDetail ───► Product
                     │
                     └──► (on Win) ───► SalesOrder ───► SalesOrderDetail ───► Product
```

## Seed data shipped with HeCRM

Running `python -m scripts.seed` (from `backend/`) against a fresh Dataverse
environment populates a realistic starter graph:

- **3 distributors** covering Mazowieckie, Śląskie, Pomorskie
- **6 retail accounts** distributed across them
- **~10 contacts** split across both tiers
- **6 products** (beer SKUs in bottle / can / keg)
- **4 opportunities** in different stages (2 open, 1 won, 1 lost)
- **2 sales orders** with line items — the won opportunities, fulfilled

This graph is the baseline for manual demos, Playwright tests, and
screenshots.

## Why the mapping looks the way it does

- **`customertypecode` over a custom field.** Uses out-of-the-box Dynamics
  semantics — no schema customization required, anyone with a vanilla
  Dataverse env can run HeCRM as-is.
- **`parentaccountid` for the retail→distributor link.** Again, OOB —
  reporting, hierarchy views, and Dynamics Sales UI all just work.
- **`salesstage` + Win/Lose actions for opportunities.** Matches what a real
  Dynamics Sales implementation would do; keeps BPF/stage reports meaningful.
- **Line items as a separate resource.** Mirrors Dataverse's own data model
  (`salesorderdetail`), keeps the API predictable, and makes each operation
  individually testable in Playwright.
