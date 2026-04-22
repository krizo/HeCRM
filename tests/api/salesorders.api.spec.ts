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
  test('won opportunity materializes into a sales order with two line items', async () => {
    const distributor = await createDistributor({ name: `SO Customer ${Date.now()}` })
    const opportunity = await createOpportunity({ customer: distributor, value: 82000 })
    await winOpportunity(opportunity)

    const order = await createOrderHeader({ customer: distributor, opportunity })

    const lagerBottle = await pickActiveProduct('Lager Premium 0.5L')
    const lagerKeg = await pickActiveProduct('Lager Draft 30L')

    await addOrderLine(order, lagerBottle, 500, 4.8)
    await addOrderLine(order, lagerKeg, 20, 260)

    await verifyOrderHasLineCount(order, 2)
    await verifyLinesSumMatches(order, 500 * 4.8 + 20 * 260)
    await verifyOrderTotalMatches(order, 500 * 4.8 + 20 * 260)
  })

  test('sales order can be created without an originating opportunity', async () => {
    const distributor = await createDistributor({ name: `Direct Order ${Date.now()}` })
    const product = await pickActiveProduct('Lager Premium 0.33L')

    const order = await createOrderHeader({ customer: distributor })

    await addOrderLine(order, product, 100, 3.5)

    await verifyOrderHasLineCount(order, 1)
    await verifyLinesSumMatches(order, 100 * 3.5)
  })
})
