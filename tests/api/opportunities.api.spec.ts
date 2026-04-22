import { test } from '../src/fixtures/baseFixture.js'
import { createDistributor } from '../src/journeys/accountSteps.js'
import {
  advanceOpportunityToStage,
  createOpportunity,
  loseOpportunity,
  verifyOpportunityIsInStageFilter,
  verifyOpportunityIsNotInOpenList,
  winOpportunity,
} from '../src/journeys/opportunitySteps.js'

test.describe('Opportunity pipeline journey', () => {
  test('new opportunity starts in prospecting and is listed there', async ({ api, data }) => {
    const ctx = { api, data }

    const distributor = await createDistributor(ctx, { name: `Prospect ${Date.now()}` })
    const opportunity = await createOpportunity(ctx, {
      customer: distributor,
      value: 42000,
      stage: 'prospecting',
    })

    await verifyOpportunityIsInStageFilter(ctx, opportunity, 'prospecting')
  })

  test('opportunity can be advanced through every open stage', async ({ api, data }) => {
    const ctx = { api, data }

    const distributor = await createDistributor(ctx, { name: `Walker ${Date.now()}` })
    const opportunity = await createOpportunity(ctx, {
      customer: distributor,
      value: 42000,
      stage: 'prospecting',
    })

    await advanceOpportunityToStage(ctx, opportunity, 'developing')
    await verifyOpportunityIsInStageFilter(ctx, opportunity, 'developing')

    await advanceOpportunityToStage(ctx, opportunity, 'proposing')
    await verifyOpportunityIsInStageFilter(ctx, opportunity, 'proposing')

    await advanceOpportunityToStage(ctx, opportunity, 'closing')
    await verifyOpportunityIsInStageFilter(ctx, opportunity, 'closing')
  })

  test('winning an opportunity moves it to Won and removes it from the open list', async ({
    api,
    data,
  }) => {
    const ctx = { api, data }

    const distributor = await createDistributor(ctx, { name: `Winner ${Date.now()}` })
    const opportunity = await createOpportunity(ctx, { customer: distributor, value: 120000 })

    await winOpportunity(ctx, opportunity)

    await verifyOpportunityIsInStageFilter(ctx, opportunity, 'won')
    await verifyOpportunityIsNotInOpenList(ctx, opportunity)
  })

  test('losing an opportunity moves it to Lost and removes it from the open list', async ({
    api,
    data,
  }) => {
    const ctx = { api, data }

    const distributor = await createDistributor(ctx, { name: `Loser ${Date.now()}` })
    const opportunity = await createOpportunity(ctx, { customer: distributor, value: 9000 })

    await loseOpportunity(ctx, opportunity)

    await verifyOpportunityIsInStageFilter(ctx, opportunity, 'lost')
    await verifyOpportunityIsNotInOpenList(ctx, opportunity)
  })

  test('full sales cycle: prospect → develop → propose → close → win', async ({ api, data }) => {
    const ctx = { api, data }

    const distributor = await createDistributor(ctx, { name: `Full Cycle ${Date.now()}` })
    const opportunity = await createOpportunity(ctx, {
      customer: distributor,
      value: 250000,
      stage: 'prospecting',
    })

    await advanceOpportunityToStage(ctx, opportunity, 'developing')
    await advanceOpportunityToStage(ctx, opportunity, 'proposing')
    await advanceOpportunityToStage(ctx, opportunity, 'closing')
    await winOpportunity(ctx, opportunity)

    await verifyOpportunityIsInStageFilter(ctx, opportunity, 'won')
    await verifyOpportunityIsNotInOpenList(ctx, opportunity)
  })
})
