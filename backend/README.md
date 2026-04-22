# HeCRM — Backend

FastAPI service that exposes a clean REST surface over Microsoft Dynamics 365
(Dataverse) using OAuth2 client credentials (S2S auth).

## Prerequisites

- Python **3.11+**
- A Dataverse environment + Entra ID app registration.
  See the top-level [README](../README.md#getting-a-microsoft-dynamics-365-environment).

## Setup

```bash
cd backend
cp .env.example .env
# fill DATAVERSE_URL, AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET

python3 -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install --upgrade pip
pip install -e ".[dev]"
```

Or, equivalently: `make install` (creates `.venv/` and installs dev deps).

## Run

```bash
make dev
# or, with the venv activated:
uvicorn app.main:app --reload
```

Then visit:

- http://127.0.0.1:8000/health — liveness probe
- http://127.0.0.1:8000/docs — Swagger UI

## Architecture

```
app/
├── main.py              # FastAPI factory + lifespan-scoped Dataverse client
├── config.py            # Pydantic settings (loaded from .env)
├── dependencies.py      # FastAPI DI for the Dataverse client
├── dynamics/
│   ├── auth.py          # MSAL-based client-credentials token provider (cached)
│   ├── client.py        # Async httpx wrapper around the Dataverse Web API
│   └── errors.py        # DataverseError → mapped to HTTP responses
├── schemas/
│   ├── common.py
│   └── account.py       # AccountCreate/Update/Read + Dataverse ↔ Pydantic mappers
└── api/
    ├── health.py
    └── accounts.py      # /api/accounts — list / get / create / update / delete
```

### Why this shape

- **Token is cached** in `DataverseTokenProvider` and refreshed ~60 s before expiry.
  MSAL is sync; we call it via `asyncio.to_thread` to avoid blocking the event loop
  on the rare refresh path.
- **Schemas are separate from wire format.** `account_from_dataverse` and
  `account_*_to_dataverse` keep the API surface stable even if Dataverse field
  names change or we switch to virtual entities later.
- **One thin client** speaks Dataverse's Web API (`/api/data/v9.2/...`). All routers
  depend on it via FastAPI DI, so tests can swap it for a fake with one override.

## Tests

```bash
make test
```

`tests/test_health.py` is a smoke test that runs without any Dataverse credentials.
Integration tests against a real environment will be added under `tests/integration/`
once seeded data is in place.
