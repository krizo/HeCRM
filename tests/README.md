# HeCRM — Test Suite

Playwright-based API and UI test suite for HeCRM, built on a strict
**journey pattern**.

## Principles

1. **Config is a fixture.** Every test receives a fully-typed `testConfig`
   (URLs, credentials, seed prefixes) from [`baseFixture.ts`](src/fixtures/baseFixture.ts).
2. **The client is a fixture.** `api` is an aggregated `HeCrmApi` with
   sub-clients per endpoint (`api.accounts.create(...)`, `api.opportunities.win(...)`).
   Specs never touch raw `fetch`.
3. **Journey steps are atomic and own the assertions.** Every journey
   function in `src/journeys/` is one HTTP call + one focused assertion,
   wrapped in `test.step()`. No compound steps hiding multi-action flows.
   Every `expect()` is inside a step — spec files never assert directly.
4. **Plumbing is invisible at the call site.** Tests and steps take only
   **business data** as parameters (accounts, opportunities, quantities,
   prices). `api`, `data`, `logger`, `testConfig` live in an ambient
   context ([`src/context.ts`](src/context.ts)) that an auto-fixture
   populates per test. Steps pull them via `getApi()` / `getData()` /
   `getLogger()` / `getTestConfig()` on demand.
5. **Everything created is cleaned up.** The `data` fixture is a
   `DataCollector` that tracks each created resource and deletes them in
   the correct dependency order in teardown. No leaked state across runs.

## Layout

```
tests/
├── playwright.config.ts        # projects: api / ui; reporters: JourneyReporter + html
├── eslint.config.js            # flat config: @eslint/js + typescript-eslint + playwright
├── .env.example                # all HECRM_* env vars (see below)
├── src/
│   ├── config/                 # TestConfig type + loader from process.env
│   ├── context.ts              # ambient bag — getApi / getData / getLogger / getPage …
│   ├── clients/                # ApiClient base + 5 sub-clients + HeCrmApi aggregator
│   ├── pages/                  # Page Objects for each UI view (AccountsPage, …)
│   ├── fixtures/               # baseFixture (api/data/logger) + uiFixture (adds page)
│   ├── journeys/               # atomic steps — *Steps.ts for API, *UiSteps.ts for UI
│   ├── logger/                 # colored, scoped, timing-aware console logger
│   └── reporters/              # JourneyReporter — console tree + markdown summary
├── api/                        # *.api.spec.ts — imports test from baseFixture
└── ui/                         # *.ui.spec.ts — imports test from uiFixture
```

## Running

```bash
cd tests
cp .env.example .env            # adjust if backend / frontend run elsewhere
npm install
npx playwright install chromium # one-time browser download for UI tests

# services needed:
(cd ../backend  && source .venv/bin/activate && make dev) &    # always
(cd ../frontend && npm run dev) &                              # UI tests only

npm run test:api                # api project only (quiet — step tree + summary only)
npm run test:api:verbose        # api project with per-request HTTP log lines (`list` added)
npm run test:ui                 # ui project only — drives Chromium through the app
npm run test:ui:verbose         # ui project with full log forwarding
npm test                        # api + ui in one go
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

## UI tests — the same doctrine, one extra layer

UI specs import `test` from [`src/fixtures/uiFixture.ts`](src/fixtures/uiFixture.ts)
instead of `baseFixture.ts`. The UI fixture extends the base with an
auto-fixture that publishes Playwright's `page` into the ambient context,
so UI journey steps reach the browser via `getPage()` — same
plumbing-free signature shape as the API steps.

Page Objects live in [`src/pages/`](src/pages/). They are exported as
module-level objects (not classes), because a PO holds no per-test state
— it's just a namespace of locator factories keyed off stable
`data-testid` attributes that the frontend deliberately exposes:

```ts
export const opportunitiesPage = {
  path: '/opportunities',
  testId: 'opportunities-page',

  async goto() { /* ... uses getPage() ... */ },
  card: (id: string) => getPage().getByTestId(`opp-card-${id}`),
  winButton: (id: string) => getPage().getByTestId(`opp-win-${id}`),
  column: (stage) => getPage().getByTestId(`kanban-col-${stage}`),
  // ...
}
```

UI spec files **seed data via API** (faster, deterministic) and then
exercise the browser with atomic UI steps:

```ts
test('clicking Win moves the card to the Won panel', async () => {
  const distributor = await createDistributor({ name: `UI Opp Win ${Date.now()}` })
  const opportunity = await createOpportunity({ customer: distributor, stage: 'proposing' })

  await openOpportunitiesPage()
  await clickWinOnCard(opportunity)

  await verifyOpportunityInWonPanel(opportunity)
  await verifyCardRemovedFromColumn(opportunity, 'proposing')
})
```

The `data` fixture's cleanup still runs — whether a test created data via
API or UI, the `DataCollector` deletes it the same way on teardown.

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

`src/reporters/JourneyReporter.ts` is a full `Reporter` implementation.
Registered first in `playwright.config.ts`, it runs alongside the stock
`html` reporter.

**Terminal output (real time):**

- A header with active projects and worker count (`onBegin`).
- One entry per finished test (`onTestEnd`) rendered as a step tree
  with per-step durations — mirrors the spec file 1:1.
- A summary block at the end: color-coded PASS/FAIL badge per journey,
  totals, plus a "Slowest tests" rollup.

**Markdown report (`test-results/summary.md`):**

Written on every run, suitable as a CI artifact or a PR comment. Three
sections:

1. **Overview** — aggregate table (journey | total | passed | failed | duration).
2. **Tests by module** — per-journey subsection listing every test that
   ran with its `#`, title, status badge, and duration. This is the
   authoritative "what ran" record.
3. **Failures** — only present when something failed; each entry has the
   test title, journey, and a fenced code block with the captured error
   (ANSI sequences stripped for clean rendering).

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

Inside a journey step the same logger is available via `getLogger()` from
`src/context.ts` — no need to thread it through function signatures.

## Lint + typecheck doctrine

`ruff` (backend), `eslint` (frontend, tests) are all wired up as
workspace-local commands — run them before pushing.

Notable rules we had to shape:

- `playwright/expect-expect` **disabled** in `api/**`. Our journey-pattern
  specs have no inline `expect()` — all assertions live inside journey
  steps (verify*, create*, advance*, etc.) and the plugin can't see through
  the `test.step()` wrapper. The doctrine is documented in
  [`eslint.config.js`](eslint.config.js).
- `no-empty-pattern` **disabled under `src/fixtures/`**. Playwright fixtures
  that need no deps require the empty object destructure `({}, use) => …`
  as their first argument — passing `_` throws at runtime. The rule is
  kept everywhere else.
- `@typescript-eslint/no-explicit-any` **error** globally. Our API clients
  and journey steps are strictly typed against `src/clients/types.ts`,
  which mirrors the backend Pydantic schemas 1:1. Any `any` is a drift
  signal.
