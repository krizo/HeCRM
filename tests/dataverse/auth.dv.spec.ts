import { test } from '../src/fixtures/dataverseFixture.js'
import {
  acquireClientCredentialToken,
  verifyTokenHasFutureExpiry,
} from '../src/journeys/dataverseSteps.js'

test.describe('Dataverse auth contract', () => {
  test('client-credentials flow yields a non-empty bearer token', async () => {
    await acquireClientCredentialToken()
  })

  test('acquired token has a future, bounded expiry', async () => {
    const token = await acquireClientCredentialToken()
    await verifyTokenHasFutureExpiry(token)
  })
})
