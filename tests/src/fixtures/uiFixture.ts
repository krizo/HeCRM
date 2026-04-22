import { setPage } from '../context.js'
import { test as baseTest } from './baseFixture.js'

interface UiFixtures {
  // Auto-fixture (never explicitly requested). Publishes Playwright's
  // per-test `page` into the ambient context so UI journey steps can reach
  // it via `getPage()` without accepting it as an argument.
  _uiPageContext: void
}

/**
 * The test handle used by every HeCRM *UI* spec.
 *
 * Extends the base (testConfig / api / logger / data / ambient context)
 * with a `page` fixture and an auto-fixture that writes it to the ambient
 * context. Spec files import `test` from here — API specs stay on
 * `baseFixture.ts`.
 */
export const test = baseTest.extend<UiFixtures>({
  _uiPageContext: [
    async ({ page }, use) => {
      setPage(page)
      try {
        await use()
      } finally {
        setPage(undefined)
      }
    },
    { auto: true },
  ],
})

export { expect } from '@playwright/test'
