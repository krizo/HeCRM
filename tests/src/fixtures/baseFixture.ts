import { test as base } from '@playwright/test'
import { loadConfig } from '../config/loadConfig.js'
import type { TestConfig } from '../config/types.js'
import { HeCrmApi } from '../clients/HeCrmApi.js'
import { Logger } from '../logger/Logger.js'
import { DataCollector } from './DataCollector.js'

export interface HeCrmFixtures {
  testConfig: TestConfig
  logger: Logger
  api: HeCrmApi
  data: DataCollector
}

/**
 * The test handle used by every HeCRM spec. Consumers get:
 *   - `testConfig`: single source of truth for URLs / creds / prefixes
 *   - `logger`:     scoped by test title, colored output + per-request timing
 *   - `api`:        aggregated HeCrmApi (accounts, contacts, products, …)
 *   - `data`:       DataCollector that auto-deletes everything a test created
 *
 * Tests should import this `test` — never the bare @playwright/test one.
 */
export const test = base.extend<HeCrmFixtures>({
  testConfig: async ({}, use) => {
    const config = loadConfig()
    await use(config)
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
})

export { expect } from '@playwright/test'
