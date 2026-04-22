import { test } from '../src/fixtures/uiFixture.js'
import { createDistributor } from '../src/journeys/accountSteps.js'
import { createOpportunity } from '../src/journeys/opportunitySteps.js'
import {
  clickAdvanceOnCard,
  clickLoseOnCard,
  clickWinOnCard,
  openOpportunitiesPage,
  verifyCardRemovedFromColumn,
  verifyOpportunityCardInColumn,
  verifyOpportunityInLostPanel,
  verifyOpportunityInWonPanel,
} from '../src/journeys/opportunityUiSteps.js'

test.describe('Opportunities UI journey', () => {
  test('newly created opportunity appears in the Prospecting column', async () => {
    const distributor = await createDistributor({ name: `UI Opp Prospect ${Date.now()}` })
    const opportunity = await createOpportunity({
      customer: distributor,
      value: 42000,
      stage: 'prospecting',
    })

    await openOpportunitiesPage()
    await verifyOpportunityCardInColumn(opportunity, 'prospecting')
  })

  test('clicking Advance moves the card from Prospecting to Developing', async () => {
    const distributor = await createDistributor({ name: `UI Opp Advance ${Date.now()}` })
    const opportunity = await createOpportunity({
      customer: distributor,
      value: 60000,
      stage: 'prospecting',
    })

    await openOpportunitiesPage()
    await verifyOpportunityCardInColumn(opportunity, 'prospecting')

    await clickAdvanceOnCard(opportunity)

    await verifyOpportunityCardInColumn(opportunity, 'developing')
    await verifyCardRemovedFromColumn(opportunity, 'prospecting')
  })

  test('clicking Win moves the card to the Won panel', async () => {
    const distributor = await createDistributor({ name: `UI Opp Win ${Date.now()}` })
    const opportunity = await createOpportunity({
      customer: distributor,
      value: 120000,
      stage: 'proposing',
    })

    await openOpportunitiesPage()
    await clickWinOnCard(opportunity)

    await verifyOpportunityInWonPanel(opportunity)
    await verifyCardRemovedFromColumn(opportunity, 'proposing')
  })

  test('clicking Lose moves the card to the Lost panel', async () => {
    const distributor = await createDistributor({ name: `UI Opp Lose ${Date.now()}` })
    const opportunity = await createOpportunity({
      customer: distributor,
      value: 9000,
      stage: 'developing',
    })

    await openOpportunitiesPage()
    await clickLoseOnCard(opportunity)

    await verifyOpportunityInLostPanel(opportunity)
    await verifyCardRemovedFromColumn(opportunity, 'developing')
  })
})
