# HeCRM

A fictional beverage/FMCG CRM — a lean reference implementation built on
**FastAPI + React (TS) + Playwright** and integrated with **Microsoft
Dynamics 365 (Dataverse Web API)**.

The domain models a drinks company that serves two customer groups:

- **Retail** — bars, restaurants, shops that buy through distributors.
- **Distributors** — regional wholesalers that aggregate retail accounts.

Data lives in Dynamics 365 — HeCRM is a thin, testable surface over the
Dataverse Web API, designed from day one to be automated against.

> **Deep-dives:**
> - [docs/SALES_PROCESS.md](docs/SALES_PROCESS.md) — the business
>   narrative every entity, stage, and endpoint derives from.
> - [docs/DYNAMICS_INTEGRATION.md](docs/DYNAMICS_INTEGRATION.md) — how
>   the FastAPI backend authenticates to and speaks the Dataverse Web
>   API (OAuth2, OData, `@odata.bind`, bound vs unbound actions, Pydantic
>   ↔ Dataverse mapping, gotchas).
> - [tests/README.md](tests/README.md) — test-suite doctrine: journey
>   pattern, ambient context, Page Objects, reporter output, and an
>   end-to-end walkthrough of a single UI test.

## Repository layout

```
HeCRM/
├── backend/   # FastAPI service — talks to Dataverse Web API
├── frontend/  # React + TypeScript UI (coming next)
└── tests/     # Playwright end-to-end suites (coming last)
```

## Entity model (Dataverse)

| HeCRM concept        | Dataverse entity | Notes                                                           |
|----------------------|------------------|-----------------------------------------------------------------|
| Retail customer      | `account`        | `customertypecode = 3` (Customer)                               |
| Distributor          | `account`        | `customertypecode = 9` (Reseller)                               |
| Retail → distributor | `account.parentaccountid` | A retail account's parent points at its distributor    |
| Contact person       | `contact`        | Linked to an account via `parentcustomerid`                     |
| Product (SKU)        | `product`        | Beer / beverage SKUs                                            |
| Pipeline             | `opportunity`    | Uses built-in `salesstage` + `WinOpportunity` / `LoseOpportunity` |
| Order                | `salesorder`     | Optional link back to originating opportunity                   |
| Order line item      | `salesorderdetail` | Product + quantity + price under an order                     |

All five entities are wired. Endpoints are under `/api/{accounts,contacts,products,opportunities,salesorders}`.

## Getting a Microsoft Dynamics 365 environment

You need a Dataverse environment and an Entra ID (Azure AD) app registration
able to call its Web API via OAuth2 client credentials (S2S).

### 1. Microsoft 365 Developer Program (free, renewable)

1. Go to https://developer.microsoft.com/microsoft-365/dev-program and **Join Now**.
2. In the dev dashboard, **Set up E5 sandbox → Instant sandbox**. You receive
   an admin account of the form `admin@<prefix>.onmicrosoft.com`. Save the password.

### 2. Power Platform — create a Developer environment

1. Sign in to https://admin.powerplatform.microsoft.com with the new admin account.
2. **Environments → + New** → Type: **Developer**, Region: `Europe` (or nearest),
   enable **Dataverse**. Wait a minute or two.
3. Open the environment — note the URL, e.g. `https://orgXXXXXXXX.crm.dynamics.com`.
   This is your **`DATAVERSE_URL`**.

### 3. (Optional) Dynamics 365 Sales trial

For the full CRM UI and seed data, request a 30-day Dynamics 365 Sales trial at
https://trials.dynamics.com using your `.onmicrosoft.com` admin. It attaches to
the same environment.

### 4. App registration in Entra ID

1. Open https://portal.azure.com → **Microsoft Entra ID → App registrations → New registration**.
2. Name: `HeCRM-Backend`. Supported account types: **Single tenant**. Register.
3. From the Overview tab, copy **Application (client) ID** and **Directory (tenant) ID**.
4. **Certificates & secrets → New client secret** → copy the **Value** immediately
   (it is never shown again).
5. **API permissions → Add a permission → Dynamics CRM → Delegated → `user_impersonation`**
   → **Grant admin consent**.

### 5. Create an Application User in Dataverse

The app registration must be mapped to a Dataverse user.

1. In https://admin.powerplatform.microsoft.com select your environment →
   **Settings → Users + permissions → Application users → + New app user**.
2. **Add an app** → pick `HeCRM-Backend`. Business unit: default.
3. Assign security role **System Administrator** (fine for development).

You now have everything needed for `backend/.env`:

| `.env` variable        | Where to find it                                                  |
|------------------------|-------------------------------------------------------------------|
| `DATAVERSE_URL`        | The environment URL from step 2                                   |
| `AZURE_TENANT_ID`      | App registration → Overview → "Directory (tenant) ID"             |
| `AZURE_CLIENT_ID`      | App registration → Overview → "Application (client) ID"           |
| `AZURE_CLIENT_SECRET`  | App registration → Certificates & secrets → Value                 |

## Running the backend

See [backend/README.md](backend/README.md) for the short version. The gist:

```bash
cd backend
cp .env.example .env                # then fill in the four values
python3 -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"
uvicorn app.main:app --reload
```

Then open http://127.0.0.1:8000/docs for the interactive Swagger UI.

## Seeding demo data

```bash
cd backend
python -m scripts.seed --reset    # wipes HeCRM-tagged data then seeds 3 distributors,
                                  # 6 retail accounts, 9 contacts, 6 SKUs,
                                  # 4 opportunities, 1 won → sales order with 3 lines.
```

Tagging convention (so `--reset` can find what's ours):

- accounts use `accountnumber` starting with `HECRM-`
- products use `productnumber` starting with `HCR-`

## Testing

Playwright-based API + UI suite lives in [`tests/`](tests/README.md). Five
design principles — full rationale and code walkthrough in the nested README:

1. **Config is a fixture.** `testConfig` (URLs, creds, seed prefixes) is
   injected into every test.
2. **The API client is a fixture.** Specs use `api.accounts.create(...)` etc.
   — never raw `fetch`.
3. **Steps are atomic and own the assertions.** Every journey step =
   one HTTP call + one focused `expect()` wrapped in `test.step()`.
   No compound steps hiding multi-action flow; the spec file is the flow.
4. **Plumbing is invisible at the call site.** Test signatures carry only
   business data. `api`, `data`, `logger`, `testConfig` live in an ambient
   context the fixture sets up per test.
5. **Everything created is cleaned up.** A `DataCollector` tracks resources
   and deletes them in dependency order on teardown — zero leaked state.

Output:

- **Terminal** — color-coded step tree per test + per-journey PASS/FAIL
  summary + slowest-tests rollup (via a custom `JourneyReporter`).
- **`test-results/summary.md`** — overview table, full per-module test
  listing, and failure details with stripped ANSI. Suitable as a CI
  artifact or PR comment.

```bash
cd tests
npm install && cp .env.example .env
npm run test:api           # step tree + summary (quiet on HTTP)
npm run test:api:verbose   # add `list` reporter to see every HTTP call
npm run lint               # ESLint flat config, --max-warnings=0
```

## Lint + typecheck

Each workspace ships its own lint + typecheck entry-point; all are wired
to fail on any warning.

| Workspace  | Tool    | Command         |
|------------|---------|-----------------|
| backend    | ruff    | `make lint`     |
| frontend   | ESLint  | `npm run lint`  |
| tests      | ESLint  | `npm run lint`  |

## Roadmap

- [x] Repo scaffold, backend skeleton
- [x] `Account` / `Contact` / `Product` / `Opportunity` / `SalesOrder` endpoints
- [x] Opportunity Win/Lose actions (wrap Dataverse bound actions)
- [x] Seed script for realistic demo graph
- [x] React + TypeScript frontend
- [x] Playwright API tests (backend) — journey pattern + custom reporter
- [x] Playwright UI tests (frontend) — same doctrine, Page Objects, `getPage()` ambient
- [x] Playwright Dataverse contract tests — raw OData, MSAL-node, pins the Microsoft boundary
- [ ] CI with seed / teardown data hooks

## License

[MIT](LICENSE)
