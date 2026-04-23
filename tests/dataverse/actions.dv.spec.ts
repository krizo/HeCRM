import { test } from '../src/fixtures/dataverseFixture.js'
import {
  createRawAccount,
  createRawOpportunity,
  invokeWinOpportunity,
  verifyOpportunityStatecode,
} from '../src/journeys/dataverseSteps.js'

test.describe('Dataverse unbound actions contract', () => {
  test('WinOpportunity flips opportunity statecode from Open (0) to Won (1)', async () => {
    const accountId = await createRawAccount(`DV Win Customer ${Date.now()}`)
    const opportunityId = await createRawOpportunity(
      accountId,
      `DV Win Opp ${Date.now()}`,
    )

    await verifyOpportunityStatecode(opportunityId, 0)
    await invokeWinOpportunity(opportunityId)
    await verifyOpportunityStatecode(opportunityId, 1)
  })
})
