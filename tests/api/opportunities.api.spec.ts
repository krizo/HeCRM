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
  test('new opportunity starts in prospecting and is listed there', async () => {
    const distributor = await createDistributor({ name: `Prospect ${Date.now()}` })
    const opportunity = await createOpportunity({
      customer: distributor,
      value: 42000,
      stage: 'prospecting',
    })

    await verifyOpportunityIsInStageFilter(opportunity, 'prospecting')
  })

  test('opportunity can be advanced through every open stage', async () => {
    const distributor = await createDistributor({ name: `Walker ${Date.now()}` })
    const opportunity = await createOpportunity({
      customer: distributor,
      value: 42000,
      stage: 'prospecting',
    })

    await advanceOpportunityToStage(opportunity, 'developing')
    await verifyOpportunityIsInStageFilter(opportunity, 'developing')

    await advanceOpportunityToStage(opportunity, 'proposing')
    await verifyOpportunityIsInStageFilter(opportunity, 'proposing')

    await advanceOpportunityToStage(opportunity, 'closing')
    await verifyOpportunityIsInStageFilter(opportunity, 'closing')
  })

  test('winning an opportunity moves it to Won and removes it from the open list', async () => {
    const distributor = await createDistributor({ name: `Winner ${Date.now()}` })
    const opportunity = await createOpportunity({ customer: distributor, value: 120000 })

    await winOpportunity(opportunity)

    await verifyOpportunityIsInStageFilter(opportunity, 'won')
    await verifyOpportunityIsNotInOpenList(opportunity)
  })

  test('losing an opportunity moves it to Lost and removes it from the open list', async () => {
    const distributor = await createDistributor({ name: `Loser ${Date.now()}` })
    const opportunity = await createOpportunity({ customer: distributor, value: 9000 })

    await loseOpportunity(opportunity)

    await verifyOpportunityIsInStageFilter(opportunity, 'lost')
    await verifyOpportunityIsNotInOpenList(opportunity)
  })

  test('full sales cycle: prospect → develop → propose → close → win', async () => {
    const distributor = await createDistributor({ name: `Full Cycle ${Date.now()}` })
    const opportunity = await createOpportunity({
      customer: distributor,
      value: 250000,
      stage: 'prospecting',
    })

    await advanceOpportunityToStage(opportunity, 'developing')
    await advanceOpportunityToStage(opportunity, 'proposing')
    await advanceOpportunityToStage(opportunity, 'closing')
    await winOpportunity(opportunity)

    await verifyOpportunityIsInStageFilter(opportunity, 'won')
    await verifyOpportunityIsNotInOpenList(opportunity)
  })
})
