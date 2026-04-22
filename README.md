# HeCRM

A fictional beverage/FMCG CRM — a lean reference implementation built on
**FastAPI + React (TS) + Playwright** and integrated with **Microsoft
Dynamics 365 (Dataverse Web API)**.

The domain models a drinks company that serves two customer groups:

- **Retail** — bars, restaurants, shops that buy directly.
- **Distributors** — wholesalers that aggregate retail accounts underneath them.

Data lives in Dynamics 365 — HeCRM is a thin, testable surface over the
Dataverse Web API, designed from day one to be automated against.

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
| Pipeline             | `opportunity`    | Sales opportunities, typically against distributors             |
| Order                | `salesorder`     | Confirmed orders                                                |

Only `account` is wired up in this first slice — rest are scaffolded iteratively.

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

## Roadmap

- [x] Repo scaffold, backend skeleton
- [x] `Account` CRUD against Dataverse Web API
- [ ] `Contact`, `Product`, `Opportunity`, `SalesOrder` endpoints
- [ ] React + TypeScript frontend
- [ ] Playwright API tests (backend)
- [ ] Playwright UI tests (frontend)
- [ ] CI with seed / teardown data hooks

## License

[MIT](LICENSE)
