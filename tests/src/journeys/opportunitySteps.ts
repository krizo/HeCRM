import { expect, test } from '../fixtures/baseFixture.js'
import type {
  Account,
  Opportunity,
  OpportunityCreate,
  OpportunityStage,
} from '../clients/types.js'
import type { Ctx } from './accountSteps.js'

// ------------------------------------------------------------------
// Atomic steps
// ------------------------------------------------------------------

export async function createOpportunity(
  { api, data }: Ctx,
  payload: OpportunityCreate,
): Promise<Opportunity> {
  return test.step(`create opportunity "${payload.name}"`, async () => {
    const created = await api.opportunities.create(payload)
    data.track('opportunity', created.id, created.name)
    expect(created.id).toBeTruthy()
    expect(created.customer_id).toBe(payload.customer_id)
    return created
  })
}

export async function advanceOpportunityStage(
  { api }: Ctx,
  id: string,
  stage: Exclude<OpportunityStage, 'won' | 'lost'>,
): Promise<Opportunity> {
  return test.step(`advance opportunity ${id.slice(0, 8)}… to stage=${stage}`, async () => {
    const updated = await api.opportunities.setStage(id, stage)
    expect(updated.stage).toBe(stage)
    return updated
  })
}

export async function winOpportunity({ api }: Ctx, id: string): Promise<Opportunity> {
  return test.step(`close opportunity as Won`, async () => {
    const closed = await api.opportunities.win(id)
    expect(closed.stage, 'WinOpportunity action must flip stage to won').toBe('won')
    return closed
  })
}

export async function loseOpportunity({ api }: Ctx, id: string): Promise<Opportunity> {
  return test.step(`close opportunity as Lost`, async () => {
    const closed = await api.opportunities.lose(id)
    expect(closed.stage, 'LoseOpportunity action must flip stage to lost').toBe('lost')
    return closed
  })
}

export async function verifyOpportunityAppearsInStageFilter(
  { api }: Ctx,
  opportunityId: string,
  stage: OpportunityStage,
): Promise<void> {
  return test.step(`opportunity appears in stage=${stage} filter`, async () => {
    const rows = await api.opportunities.list({ stage })
    const hit = rows.find((o) => o.id === opportunityId)
    expect(hit, `opportunity ${opportunityId.slice(0, 8)}… must appear when filtering by ${stage}`).toBeDefined()
  })
}

// ------------------------------------------------------------------
// Compound steps
// ------------------------------------------------------------------

export async function openDealAgainst(
  ctx: Ctx,
  customer: Account,
  opts: { value?: number; name?: string } = {},
): Promise<Opportunity> {
  return test.step(`open sales deal against "${customer.name}"`, async () => {
    const opportunity = await createOpportunity(ctx, {
      name: opts.name ?? `Test deal — ${customer.name}`,
      customer_id: customer.id,
      estimated_value: opts.value ?? 42000,
      stage: 'prospecting',
      description: 'Created by HeCRM automation test suite.',
    })
    await verifyOpportunityAppearsInStageFilter(ctx, opportunity.id, 'prospecting')
    return opportunity
  })
}

export async function walkOpportunityThroughPipeline(
  ctx: Ctx,
  opportunity: Opportunity,
): Promise<Opportunity> {
  return test.step(`walk opportunity through the full open pipeline`, async () => {
    let current = opportunity
    for (const stage of ['developing', 'proposing', 'closing'] as const) {
      current = await advanceOpportunityStage(ctx, current.id, stage)
      await verifyOpportunityAppearsInStageFilter(ctx, current.id, stage)
    }
    return current
  })
}

export async function winAndVerify(ctx: Ctx, opportunity: Opportunity): Promise<Opportunity> {
  return test.step(`win opportunity and verify final state`, async () => {
    const won = await winOpportunity(ctx, opportunity.id)
    await verifyOpportunityAppearsInStageFilter(ctx, opportunity.id, 'won')

    // `won` must no longer appear in the `open_only` list
    const openOnly = await ctx.api.opportunities.list({ open_only: true })
    expect(openOnly.find((o) => o.id === opportunity.id), 'won opp must not leak into open list').toBeUndefined()

    return won
  })
}

export async function loseAndVerify(ctx: Ctx, opportunity: Opportunity): Promise<Opportunity> {
  return test.step(`lose opportunity and verify final state`, async () => {
    const lost = await loseOpportunity(ctx, opportunity.id)
    await verifyOpportunityAppearsInStageFilter(ctx, opportunity.id, 'lost')
    return lost
  })
}
