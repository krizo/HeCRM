# HeCRM — Frontend

React + TypeScript + Tailwind UI on top of the HeCRM FastAPI backend.

## Stack

- Vite + React 19 + TypeScript
- Tailwind CSS v4 (zero-config via `@tailwindcss/vite`)
- TanStack Query for data fetching + cache
- React Router v7 for navigation

## Setup

```bash
cd frontend
cp .env.example .env        # point VITE_API_BASE_URL at your backend
npm install
npm run dev                 # http://127.0.0.1:5173
```

The backend needs to be running separately (`cd backend && make dev`).
CORS is already configured backend-side for `http://localhost:5173`.

## Pages

| Route                     | What it shows                                                |
|---------------------------|--------------------------------------------------------------|
| `/`                       | Dashboard tiles + recent orders                              |
| `/accounts`               | All accounts, filter by type, search by name                 |
| `/accounts/:id`           | Account detail — contacts, children, opportunities, orders   |
| `/opportunities`          | Pipeline — 4 open-stage columns + Won/Lost panels            |
| `/salesorders`            | Sales order list                                             |
| `/salesorders/:id`        | Order header + line items                                    |
| `/products`               | SKU catalog                                                  |

## Data-testid selectors

Every primary page/table/card has a stable `data-testid`. These exist to keep
the Playwright suite robust — see component source for exact names.
