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

npm run test:api                # api project only (quiet — step tree + summary only)
npm run test:api:verbose        # api project with per-request HTTP log lines (`list` reporter added)
npm run test:ui                 # ui project only (once written)
npm test                        # both
npm run report                  # open the HTML report
npm run typecheck               # TypeScript strict, no emit
npm run lint                    # ESLint flat config, --max-warnings=0
npm run lint:fix                # auto-fix what ESLint knows how to
```

ESLint flat config ([`eslint.config.js`](eslint.config.js)) extends
`@eslint/js recommended` + `typescript-eslint recommended` +
`eslint-plugin-playwright` (recommended). Journey-pattern tests have no
inline `expect()` calls — `playwright/expect-expect` is disabled with a
comment explaining why (assertions live in journey steps). Unused
fixture parameters use `_` to satisfy `no-empty-pattern`.

## Step granularity — atomic only

**Every journey function is atomic: one HTTP call + one focused assertion.**
Compound steps that hide multi-action flow are explicitly avoided — they make
specs short but opaque, and a reader of the test should be able to see
exactly which business actions happen and in what order.

```ts
export async function advanceOpportunityToStage(
  opportunity: Opportunity,
  stage: Exclude<OpportunityStage, 'won' | 'lost'>,
): Promise<Opportunity> {
  return test.step(`advance "${opportunity.name}" to stage=${stage}`, async () => {
    const updated = await getApi().opportunities.setStage(opportunity.id, stage)
    expect(updated.stage).toBe(stage)
    return updated
  })
}
```

- Wrapped in `test.step()` so the reporter renders it in the tree.
- Takes **only business parameters** (the opportunity, the target stage).
  `api`, `data`, `logger`, `testConfig` are fetched on demand via
  `getApi()` / `getData()` / `getLogger()` / `getTestConfig()`, which pull
  from the ambient context the auto-fixture sets up per test.
- Makes exactly one API call.
- Asserts exactly what that call was supposed to achieve.

## Test spec shape

A spec reads top-to-bottom as the exact sequence of business actions. The
signature of the async callback is **empty** — no `{ api, data }`
destructuring, no plumbing context variable. Every argument visible is real
business data. **No assertions in the spec itself** — just a clean list of
step calls:

```ts
test('full sales cycle: prospect → develop → propose → close → win', async () => {
  const distributor = await createDistributor({ name: `Full Cycle ${Date.now()}` })
  const opportunity = await createOpportunity({
    customer: distributor,
    value: 250000,
    stage: 'prospecting',
  })

  await advanceOpportunityToStage(opportunity, 'developing')
  await advanceOpportunityToStage(opportunity, 'proposing')
  await advanceOpportunityToStage(opportunity, 'closing')
  await winOpportunity(opportunity)

  await verifyOpportunityIsInStageFilter(opportunity, 'won')
  await verifyOpportunityIsNotInOpenList(opportunity)
})
```

Reading this test — without knowing Playwright or the backend — you can list
every business action and every piece of data fed to it: create distributor
(name = `Full Cycle ...`) → create opportunity (customer = distributor,
value = 250000, stage = prospecting) → advance to three stages → win →
verify in Won filter → verify not in open list. That's the flow, and the
reporter's step tree mirrors it 1:1.

### Why no `{ api, data }` in the test signature

Plumbing (API client, data collector, logger) is noise at the call site.
A test's signature should declare **what the test is about** — the inputs
it's exercising. An auto-fixture ([`baseFixture.ts`](src/fixtures/baseFixture.ts))
sets a module-level context (`src/context.ts`) before each test, steps
pull what they need via `getApi()` / `getData()` / `getLogger()`. Because
`workers: 1` + `fullyParallel: false` is pinned in `playwright.config.ts`
only one test is active at a time, so module state is safe. Swap for
`AsyncLocalStorage` if/when we enable parallelism.

## Custom reporter

`src/reporters/JourneyReporter.ts` is a full `Reporter` implementation:

- Groups tests by **journey** (test-file basename — `accounts.api`, `opportunities.api`, …).
- Shows a per-test step tree with durations.
- At the end, prints a color-coded summary and a "Slowest tests" rollup.
- Writes a machine-consumable `test-results/summary.md` table suitable for
  CI artifacts / PR comments.

Custom reporter is registered first in `playwright.config.ts` so it runs
alongside the stock `html` reporter.

### Why the reporter doesn't forward worker stdout

`JourneyReporter` deliberately omits `onStdOut` / `onStdErr` handlers.
IDE Playwright integrations (WebStorm, VS Code) silently inject their
own reporter that echoes worker output to the IDE's terminal pane.
Forwarding the same chunk here on top of that caused every logger line
to appear twice under an IDE-launched run. The `list` reporter has the
same problem when stacked. Leaving stdout forwarding solely to whichever
tool is "on top" keeps each line exactly once in every invocation mode.

When running via `npm run test:api` (no IDE, no `list`), per-request
HTTP logs are silent by design — the step tree tells you the business
flow. If you need the HTTP-level detail from the CLI, use
`npm run test:api:verbose` which stacks the `list` reporter on top of
ours.

## Logger

`src/logger/Logger.ts` provides a scoped, color-coded console logger that's
injected into every API call inside `ApiClient`. Each HTTP request prints
method, status (colored by class), and duration. Log level is controlled
via `HECRM_LOG_LEVEL` (`debug`, `info`, `warn`, `error`).
