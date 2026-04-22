import { test } from '../src/fixtures/baseFixture.js'
import { createDistributor } from '../src/journeys/accountSteps.js'
import { createOpportunity, winOpportunity } from '../src/journeys/opportunitySteps.js'
import {
  addOrderLine,
  createOrderHeader,
  pickActiveProduct,
  verifyLinesSumMatches,
  verifyOrderHasLineCount,
  verifyOrderTotalMatches,
} from '../src/journeys/salesOrderSteps.js'

test.describe('Sales order journey', () => {
  test('won opportunity materializes into a sales order with two line items', async ({
    api,
    data,
  }) => {
    const ctx = { api, data }

    const distributor = await createDistributor(ctx, { name: `SO Customer ${Date.now()}` })
    const opportunity = await createOpportunity(ctx, { customer: distributor, value: 82000 })
    await winOpportunity(ctx, opportunity)

    const order = await createOrderHeader(ctx, {
      customer: distributor,
      opportunity,
    })

    const lagerBottle = await pickActiveProduct(ctx, 'Lager Premium 0.5L')
    const lagerKeg = await pickActiveProduct(ctx, 'Lager Draft 30L')

    await addOrderLine(ctx, order, lagerBottle, 500, 4.8)
    await addOrderLine(ctx, order, lagerKeg, 20, 260)

    await verifyOrderHasLineCount(ctx, order, 2)
    await verifyLinesSumMatches(ctx, order, 500 * 4.8 + 20 * 260)
    await verifyOrderTotalMatches(ctx, order, 500 * 4.8 + 20 * 260)
  })

  test('sales order can be created without an originating opportunity', async ({ api, data }) => {
    const ctx = { api, data }

    const distributor = await createDistributor(ctx, { name: `Direct Order ${Date.now()}` })
    const product = await pickActiveProduct(ctx, 'Lager Premium 0.33L')

    const order = await createOrderHeader(ctx, { customer: distributor })

    await addOrderLine(ctx, order, product, 100, 3.5)

    await verifyOrderHasLineCount(ctx, order, 1)
    await verifyLinesSumMatches(ctx, order, 100 * 3.5)
  })
})
