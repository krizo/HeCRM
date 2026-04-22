import { test as base } from '@playwright/test'
import { HeCrmApi } from '../clients/HeCrmApi.js'
import { loadConfig } from '../config/loadConfig.js'
import type { TestConfig } from '../config/types.js'
import { setContext } from '../context.js'
import { Logger } from '../logger/Logger.js'
import { DataCollector } from './DataCollector.js'

interface HeCrmFixtures {
  testConfig: TestConfig
  logger: Logger
  api: HeCrmApi
  data: DataCollector
  // Auto-fixture (never explicitly requested). Wraps the test body in an
  // AsyncLocalStorage scope so journey steps can access api / data / logger
  // without having to receive them as arguments.
  _ambientContext: void
}

/**
 * The test handle used by every HeCRM spec.
 *
 * Specs call journey steps with only business parameters — no plumbing.
 * Inside steps, `getApi()`, `getData()`, `getLogger()` (and `getTestConfig()`)
 * pull the per-test instances from AsyncLocalStorage.
 */
export const test = base.extend<HeCrmFixtures>({
  testConfig: async ({}, use) => {
    await use(loadConfig())
  },

  logger: async ({}, use, testInfo) => {
    const logger = new Logger(testInfo.title)
    logger.info(`start → ${testInfo.file.split('/').slice(-2).join('/')}`)
    await use(logger)
    logger.info(`end   ← status=${testInfo.status ?? 'unknown'} duration=${testInfo.duration}ms`)
  },

  api: async ({ request, testConfig, logger }, use) => {
    const api = new HeCrmApi(request, testConfig, logger)
    await use(api)
  },

  data: async ({ api, logger }, use) => {
    const collector = new DataCollector(api, logger.child('data'))
    await use(collector)
    await collector.cleanup()
  },

  _ambientContext: [
    async ({ api, data, logger, testConfig }, use) => {
      setContext({ api, data, logger, testConfig })
      try {
        await use()
      } finally {
        setContext(undefined)
      }
    },
    { auto: true },
  ],
})

export { expect } from '@playwright/test'
