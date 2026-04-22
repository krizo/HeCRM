import { getPage } from '../context.js'
import type { OpportunityStage } from '../clients/types.js'

export const opportunitiesPage = {
  path: '/opportunities',
  testId: 'opportunities-page',

  async goto(): Promise<void> {
    const page = getPage()
    await page.goto(this.path)
    await page.getByTestId(this.testId).waitFor({ state: 'visible' })
  },

  card(opportunityId: string) {
    return getPage().getByTestId(`opp-card-${opportunityId}`)
  },

  advanceButton(opportunityId: string) {
    return getPage().getByTestId(`opp-advance-${opportunityId}`)
  },

  winButton(opportunityId: string) {
    return getPage().getByTestId(`opp-win-${opportunityId}`)
  },

  loseButton(opportunityId: string) {
    return getPage().getByTestId(`opp-lose-${opportunityId}`)
  },

  // For open stages (prospecting/developing/proposing/closing) the column
  // is a full Card; for won/lost it's the bottom panel.
  column(stage: Exclude<OpportunityStage, 'won' | 'lost'>) {
    return getPage().getByTestId(`kanban-col-${stage}`)
  },

  panel(stage: 'won' | 'lost') {
    return getPage().getByTestId(`kanban-panel-${stage}`)
  },

  panelItem(stage: 'won' | 'lost', opportunityId: string) {
    return getPage().getByTestId(`kanban-panel-${stage}-item-${opportunityId}`)
  },
}
