import { test } from '../src/fixtures/baseFixture.js'
import { establishDistributor } from '../src/journeys/accountSteps.js'
import { openDealAgainst, winAndVerify } from '../src/journeys/opportunitySteps.js'
import {
  materializeOrder,
  pickActiveProduct,
  verifyOrderMatchesLines,
} from '../src/journeys/salesOrderSteps.js'

test.describe('Sales order journey', () => {
  test('a won opportunity can be materialized into a sales order with line items', async ({ api, data }) => {
    const ctx = { api, data }

    const distributor = await establishDistributor(ctx, { name: `SO Customer ${Date.now()}` })
    const opportunity = await openDealAgainst(ctx, distributor, { value: 82000 })
    const wonOpp = await winAndVerify(ctx, opportunity)

    const lager05 = await pickActiveProduct(ctx, 'Lager Premium 0.5L')
    const lagerKeg = await pickActiveProduct(ctx, 'Lager Draft 30L')

    const lines = [
      { product: lager05, quantity: 500, pricePerUnit: 4.8 },
      { product: lagerKeg, quantity: 20, pricePerUnit: 260 },
    ]

    const order = await materializeOrder(ctx, { customer: distributor, opportunity: wonOpp, lines })
    await verifyOrderMatchesLines(ctx, order, lines)
  })

  test('order total matches the sum of its line items', async ({ api, data }) => {
    const ctx = { api, data }

    const distributor = await establishDistributor(ctx, { name: `Totals Check ${Date.now()}` })
    const product = await pickActiveProduct(ctx, 'Lager Premium 0.33L')

    const lines = [{ product, quantity: 100, pricePerUnit: 3.5 }]
    const order = await materializeOrder(ctx, { customer: distributor, lines })
    await verifyOrderMatchesLines(ctx, order, lines)
  })
})
