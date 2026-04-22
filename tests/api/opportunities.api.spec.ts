import { test } from '../src/fixtures/baseFixture.js'
import { establishDistributor } from '../src/journeys/accountSteps.js'
import {
  loseAndVerify,
  openDealAgainst,
  walkOpportunityThroughPipeline,
  winAndVerify,
} from '../src/journeys/opportunitySteps.js'

test.describe('Opportunity pipeline journey', () => {
  test('an opportunity can walk through every open stage', async ({ api, data }) => {
    const ctx = { api, data }
    const distributor = await establishDistributor(ctx, { name: `Pipeline Walker ${Date.now()}` })
    const opp = await openDealAgainst(ctx, distributor, { value: 42000 })
    await walkOpportunityThroughPipeline(ctx, opp)
  })

  test('winning an opportunity closes it and removes it from the open list', async ({ api, data }) => {
    const ctx = { api, data }
    const distributor = await establishDistributor(ctx, { name: `Winner ${Date.now()}` })
    const opp = await openDealAgainst(ctx, distributor, { value: 120000 })
    await winAndVerify(ctx, opp)
  })

  test('losing an opportunity parks it in the Lost bucket', async ({ api, data }) => {
    const ctx = { api, data }
    const distributor = await establishDistributor(ctx, { name: `Loser ${Date.now()}` })
    const opp = await openDealAgainst(ctx, distributor, { value: 9000 })
    await loseAndVerify(ctx, opp)
  })

  test('full sales cycle: open → walk → win', async ({ api, data }) => {
    const ctx = { api, data }
    const distributor = await establishDistributor(ctx, { name: `Full Cycle ${Date.now()}` })
    const opp = await openDealAgainst(ctx, distributor, { value: 250000 })
    const closing = await walkOpportunityThroughPipeline(ctx, opp)
    await winAndVerify(ctx, closing)
  })
})
