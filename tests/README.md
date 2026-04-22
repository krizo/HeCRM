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

## Step granularity — atomic only

**Every journey function is atomic: one HTTP call + one focused assertion.**
Compound steps that hide multi-action flow are explicitly avoided — they make
specs short but opaque, and a reader of the test should be able to see
exactly which business actions happen and in what order.

```ts
export async function advanceOpportunityToStage(
  { api }: Ctx,
  opportunity: Opportunity,
  stage: Exclude<OpportunityStage, 'won' | 'lost'>,
): Promise<Opportunity> {
  return test.step(`advance "${opportunity.name}" to stage=${stage}`, async () => {
    const updated = await api.opportunities.setStage(opportunity.id, stage)
    expect(updated.stage).toBe(stage)
    return updated
  })
}
```

- Wrapped in `test.step()` so the reporter renders it in the tree.
- Takes a `Ctx` (the `api` + `data` bundle from the fixture).
- Makes exactly one API call.
- Asserts exactly what that call was supposed to achieve.

## Test spec shape

A spec reads top-to-bottom as the exact sequence of business actions. **No
assertions in the spec itself** — just a clean list of step calls:

```ts
test('full sales cycle: prospect → develop → propose → close → win', async ({ api, data }) => {
  const ctx = { api, data }

  const distributor = await createDistributor(ctx, { name: `Full Cycle ${Date.now()}` })
  const opportunity = await createOpportunity(ctx, {
    customer: distributor,
    value: 250000,
    stage: 'prospecting',
  })

  await advanceOpportunityToStage(ctx, opportunity, 'developing')
  await advanceOpportunityToStage(ctx, opportunity, 'proposing')
  await advanceOpportunityToStage(ctx, opportunity, 'closing')
  await winOpportunity(ctx, opportunity)

  await verifyOpportunityIsInStageFilter(ctx, opportunity, 'won')
  await verifyOpportunityIsNotInOpenList(ctx, opportunity)
})
```

Reading this test — without knowing Playwright or the backend — you can list
every business action: create dist → create opp → advance stage ×3 → win →
verify in Won filter → verify not in open list. That's the flow, and the
reporter's step tree mirrors it 1:1.

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
