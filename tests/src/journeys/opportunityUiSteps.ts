import { expect, test } from '../fixtures/uiFixture.js'
import { opportunitiesPage } from '../pages/OpportunitiesPage.js'
import type { Opportunity, OpportunityStage } from '../clients/types.js'

// ---------------------------------------------------------------------------
// Atomic UI steps
// ---------------------------------------------------------------------------

export async function openOpportunitiesPage(): Promise<void> {
  return test.step('open /opportunities', async () => {
    await opportunitiesPage.goto()
  })
}

export async function clickAdvanceOnCard(opportunity: Opportunity): Promise<void> {
  return test.step(`click Advance on opportunity card "${opportunity.name}"`, async () => {
    await opportunitiesPage.advanceButton(opportunity.id).click()
  })
}

export async function clickWinOnCard(opportunity: Opportunity): Promise<void> {
  return test.step(`click Win on opportunity card "${opportunity.name}"`, async () => {
    await opportunitiesPage.winButton(opportunity.id).click()
  })
}

export async function clickLoseOnCard(opportunity: Opportunity): Promise<void> {
  return test.step(`click Lose on opportunity card "${opportunity.name}"`, async () => {
    await opportunitiesPage.loseButton(opportunity.id).click()
  })
}

// ---------------------------------------------------------------------------
// Atomic UI verifications
// ---------------------------------------------------------------------------

export async function verifyOpportunityCardInColumn(
  opportunity: Opportunity,
  stage: Exclude<OpportunityStage, 'won' | 'lost'>,
): Promise<void> {
  return test.step(`opportunity "${opportunity.name}" card is in ${stage} column`, async () => {
    const card = opportunitiesPage.column(stage).getByTestId(`opp-card-${opportunity.id}`)
    await expect(card).toBeVisible()
  })
}

export async function verifyOpportunityInWonPanel(opportunity: Opportunity): Promise<void> {
  return test.step(`opportunity "${opportunity.name}" appears in the Won panel`, async () => {
    await expect(opportunitiesPage.panelItem('won', opportunity.id)).toBeVisible()
  })
}

export async function verifyOpportunityInLostPanel(opportunity: Opportunity): Promise<void> {
  return test.step(`opportunity "${opportunity.name}" appears in the Lost panel`, async () => {
    await expect(opportunitiesPage.panelItem('lost', opportunity.id)).toBeVisible()
  })
}

export async function verifyCardRemovedFromColumn(
  opportunity: Opportunity,
  stage: Exclude<OpportunityStage, 'won' | 'lost'>,
): Promise<void> {
  return test.step(`opportunity "${opportunity.name}" card is NOT in ${stage} column`, async () => {
    const card = opportunitiesPage.column(stage).getByTestId(`opp-card-${opportunity.id}`)
    await expect(card).toHaveCount(0)
  })
}
