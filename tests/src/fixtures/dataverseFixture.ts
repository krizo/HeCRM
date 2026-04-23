import { DataverseRawClient } from '../clients/DataverseRawClient.js'
import { setDataverse } from '../context.js'
import { DataverseCollector } from './DataverseCollector.js'
import { test as baseTest } from './baseFixture.js'

interface DataverseFixtures {
  dv: DataverseRawClient
  dvData: DataverseCollector
  _dvContext: void
}

/**
 * The test handle for the `dataverse` Playwright project — contract
 * tests that hit Dataverse Web API directly (no FastAPI in the loop).
 *
 * All four Azure credentials must be present in the environment, otherwise
 * every test in the project is skipped with a clear message. This keeps the
 * dataverse project harmless in pipelines that don't have SPN credentials.
 */
export const test = baseTest.extend<DataverseFixtures>({
  dv: async ({ request, testConfig, logger }, use) => {
    const { dataverse } = testConfig
    const missing: string[] = []
    if (!dataverse.url) missing.push('HECRM_DATAVERSE_URL')
    if (!dataverse.tenantId) missing.push('HECRM_AZURE_TENANT_ID')
    if (!dataverse.clientId) missing.push('HECRM_AZURE_CLIENT_ID')
    if (!dataverse.clientSecret) missing.push('HECRM_AZURE_CLIENT_SECRET')
    if (missing.length) {
      baseTest.skip(
        true,
        `Dataverse project skipped — missing env var(s): ${missing.join(', ')}`,
      )
    }
    const client = new DataverseRawClient(
      dataverse.url,
      dataverse.tenantId,
      dataverse.clientId,
      dataverse.clientSecret,
      request,
      logger.child('dv'),
    )
    await use(client)
  },

  dvData: async ({ dv, logger }, use) => {
    const collector = new DataverseCollector(dv, logger.child('dv-cleanup'))
    await use(collector)
    await collector.cleanup()
  },

  _dvContext: [
    async ({ dv, dvData }, use) => {
      setDataverse({ dv, dvData })
      try {
        await use()
      } finally {
        setDataverse(undefined)
      }
    },
    { auto: true },
  ],
})

export { expect } from '@playwright/test'
