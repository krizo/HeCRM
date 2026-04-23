import { test } from '../src/fixtures/dataverseFixture.js'
import { verifyMissingResourceReturns404 } from '../src/journeys/dataverseSteps.js'

test.describe('Dataverse error envelope contract', () => {
  test('GET on a non-existent GUID returns 404 with { error: { code: "0x…", message } }', async () => {
    await verifyMissingResourceReturns404('accounts')
  })
})
