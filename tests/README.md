# HeCRM — Test Suite

Playwright-based API and UI test suite for HeCRM, built on a strict
**journey pattern**.

## Principles

1. **Config is a fixture.** Every test receives a fully-typed `testConfig`
   (URLs, credentials, seed prefixes) from [`baseFixture.ts`](src/fixtures/baseFixture.ts).
2. **The client is a fixture.** `api` is an aggregated `HeCrmApi` with
   sub-clients per endpoint (`api.accounts.create(...)`, `api.opportunities.win(...)`).
   Specs never touch raw `fetch`.
3. **Journey steps own the assertions.** Atomic steps (one API call) and
   compound steps (business processes composed of atomics) both live in
   `src/journeys/`. Every `expect()` is there — spec files only compose.
4. **Everything created is cleaned up.** The `data` fixture is a
   `DataCollector` that tracks each created resource and deletes them in
   the correct dependency order in teardown. No leaked state across runs.

## Layout

```
tests/
├── playwright.config.ts        # projects: api / ui
├── .env.example                # all HECRM_* env vars
├── src/
│   ├── config/                 # TestConfig type + loader
│   ├── clients/                # ApiClient base + 5 sub-clients + HeCrmApi aggregator
│   ├── fixtures/               # test.extend: testConfig, api, logger, data
│   ├── journeys/               # atomic + compound business-process steps
│   ├── logger/                 # colored, scoped, timing-aware console logger
│   └── reporters/              # JourneyReporter — custom console + markdown report
├── api/                        # *.api.spec.ts — backend tests
└── ui/                         # *.ui.spec.ts — frontend tests (wired up next)
```

## Running

```bash
cd tests
cp .env.example .env            # adjust if backend runs elsewhere
npm install

# make sure the backend is up on http://127.0.0.1:8000
(cd ../backend && source .venv/bin/activate && make dev) &

npm run test:api                # api project only
npm run test:ui                 # ui project only (once written)
npm test                        # both
npm run report                  # open the HTML report
```

## What makes a step a step?

Every journey function follows the same shape:

```ts
export async function openDealAgainst(ctx: Ctx, customer: Account, opts?) {
  return test.step(`open sales deal against "${customer.name}"`, async () => {
    const opp = await createOpportunity(ctx, { ... })                    // atomic
    await verifyOpportunityAppearsInStageFilter(ctx, opp.id, 'prospecting') // atomic
    return opp
  })
}
```

- Wrapped in `test.step()` so the reporter can render it in the tree.
- Takes a `Ctx` (the `api` + `data` bundle from the fixture).
- Returns the thing it created — or just asserts and returns `void`.
- Composes smaller steps when it represents a business process.

## Test spec shape

A spec is narrative — it tells a story by naming steps. **No assertions.**

```ts
test('full sales cycle: open → walk → win', async ({ api, data }) => {
  const ctx = { api, data }
  const distributor = await establishDistributor(ctx)
  const opp        = await openDealAgainst(ctx, distributor, { value: 250000 })
  const closing    = await walkOpportunityThroughPipeline(ctx, opp)
  await winAndVerify(ctx, closing)
})
```

## Custom reporter

`src/reporters/JourneyReporter.ts` is a full `Reporter` implementation:

- Groups tests by **journey** (test-file basename — `accounts.api`, `opportunities.api`, …).
- Shows a per-test step tree with durations.
- At the end, prints a color-coded summary and a "Slowest tests" rollup.
- Writes a machine-consumable `test-results/summary.md` table suitable for
  CI artifacts / PR comments.

Custom reporter is registered first in `playwright.config.ts` so it runs
alongside the stock `list` + `html` reporters.

## Logger

`src/logger/Logger.ts` provides a scoped, color-coded console logger that's
injected into every API call inside `ApiClient`. Each HTTP request prints
method, status (colored by class), and duration. Log level is controlled
via `HECRM_LOG_LEVEL` (`debug`, `info`, `warn`, `error`).
