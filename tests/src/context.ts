import type { Page } from '@playwright/test'
import type { HeCrmApi } from './clients/HeCrmApi.js'
import type { TestConfig } from './config/types.js'
import type { DataCollector } from './fixtures/DataCollector.js'
import type { Logger } from './logger/Logger.js'

interface StepContext {
  readonly api: HeCrmApi
  readonly data: DataCollector
  readonly logger: Logger
  readonly testConfig: TestConfig
}

// Module-level active context, set by the auto-fixture in baseFixture.ts
// before the test body runs and cleared in teardown.
// Safe because playwright.config.ts pins `workers: 1` and
// `fullyParallel: false`, so at most one test is active at any time.
// If we ever enable parallelism, swap this for AsyncLocalStorage.
let _active: StepContext | undefined
let _activePage: Page | undefined

export function setContext(ctx: StepContext | undefined): void {
  _active = ctx
}

export function setPage(page: Page | undefined): void {
  _activePage = page
}

function current(): StepContext {
  if (!_active) {
    throw new Error(
      'HeCRM test context is not active — did you import `test` from a non-extended source, ' +
        'or call a step outside of a test body?',
    )
  }
  return _active
}

// Ambient accessors available inside any step / helper running within a test.
// Steps receive only business parameters; plumbing is fetched on demand.
export const getApi = (): HeCrmApi => current().api
export const getData = (): DataCollector => current().data
export const getLogger = (): Logger => current().logger
export const getTestConfig = (): TestConfig => current().testConfig

export function getPage(): Page {
  if (!_activePage) {
    throw new Error(
      'UI page context is not active — use `test` from `uiFixture.ts` (not `baseFixture.ts`) ' +
        'for UI specs.',
    )
  }
  return _activePage
}
