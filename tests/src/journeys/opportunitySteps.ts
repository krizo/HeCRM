import { expect, test } from '../fixtures/baseFixture.js'
import { getApi, getData } from '../context.js'
import type { Account, Opportunity, OpportunityStage } from '../clients/types.js'

// ---------------------------------------------------------------------------
// Atomic steps. Business parameters only — no ctx.
// ---------------------------------------------------------------------------

export async function createOpportunity(opts: {
  customer: Account
  name?: string
  value?: number
  stage?: Exclude<OpportunityStage, 'won' | 'lost'>
  description?: string
}): Promise<Opportunity> {
  const label = opts.name ?? `Test deal — ${opts.customer.name}`
  return test.step(
    `create opportunity "${label}" against "${opts.customer.name}" at stage=${opts.stage ?? 'prospecting'}`,
    async () => {
      const created = await getApi().opportunities.create({
        name: label,
        customer_id: opts.customer.id,
        estimated_value: opts.value,
        stage: opts.stage ?? 'prospecting',
        description: opts.description,
      })
      getData().track('opportunity', created.id, created.name)
      expect(created.id).toBeTruthy()
      expect(created.customer_id).toBe(opts.customer.id)
      expect(created.stage).toBe(opts.stage ?? 'prospecting')
      return created
    },
  )
}

export async function advanceOpportunityToStage(
  opportunity: Opportunity,
  stage: Exclude<OpportunityStage, 'won' | 'lost'>,
): Promise<Opportunity> {
  return test.step(`advance "${opportunity.name}" to stage=${stage}`, async () => {
    const updated = await getApi().opportunities.setStage(opportunity.id, stage)
    expect(updated.stage).toBe(stage)
    return updated
  })
}

export async function winOpportunity(opportunity: Opportunity): Promise<Opportunity> {
  return test.step(`close "${opportunity.name}" as Won (WinOpportunity action)`, async () => {
    const closed = await getApi().opportunities.win(opportunity.id)
    expect(closed.stage, 'WinOpportunity must flip stage to won').toBe('won')
    return closed
  })
}

export async function loseOpportunity(opportunity: Opportunity): Promise<Opportunity> {
  return test.step(`close "${opportunity.name}" as Lost (LoseOpportunity action)`, async () => {
    const closed = await getApi().opportunities.lose(opportunity.id)
    expect(closed.stage, 'LoseOpportunity must flip stage to lost').toBe('lost')
    return closed
  })
}

export async function verifyOpportunityIsInStageFilter(
  opportunity: Opportunity,
  stage: OpportunityStage,
): Promise<void> {
  return test.step(`"${opportunity.name}" appears when filtering by stage=${stage}`, async () => {
    const rows = await getApi().opportunities.list({ stage })
    expect(
      rows.find((o) => o.id === opportunity.id),
      `opportunity must appear when filtering by ${stage}`,
    ).toBeDefined()
  })
}

export async function verifyOpportunityIsNotInOpenList(opportunity: Opportunity): Promise<void> {
  return test.step(`"${opportunity.name}" is NOT in the open-only list`, async () => {
    const rows = await getApi().opportunities.list({ open_only: true })
    expect(
      rows.find((o) => o.id === opportunity.id),
      'closed opportunity must not leak into open-only list',
    ).toBeUndefined()
  })
}
