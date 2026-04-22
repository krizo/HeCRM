import { test } from '../src/fixtures/uiFixture.js'
import { createDistributor } from '../src/journeys/accountSteps.js'
import {
  addOrderLine,
  createOrderHeader,
  pickActiveProduct,
} from '../src/journeys/salesOrderSteps.js'
import {
  openSalesOrderDetailFromList,
  openSalesOrdersPage,
  verifyLineVisibleForProduct,
  verifyOrderDetailShowsLineCount,
  verifySalesOrderVisibleInList,
} from '../src/journeys/salesOrderUiSteps.js'

test.describe('Sales orders UI journey', () => {
  test('sales order is visible in the orders list', async () => {
    const distributor = await createDistributor({ name: `UI SO List ${Date.now()}` })
    const order = await createOrderHeader({ customer: distributor })

    await openSalesOrdersPage()
    await verifySalesOrderVisibleInList(order)
  })

  test('order detail page shows the two line items we added via API', async () => {
    const distributor = await createDistributor({ name: `UI SO Detail ${Date.now()}` })
    const order = await createOrderHeader({ customer: distributor })

    const bottle = await pickActiveProduct('Lager Premium 0.5L')
    const keg = await pickActiveProduct('Lager Draft 30L')
    await addOrderLine(order, bottle, 20, 4.8)
    await addOrderLine(order, keg, 5, 260)

    await openSalesOrdersPage()
    await openSalesOrderDetailFromList(order)

    await verifyOrderDetailShowsLineCount(2)
    await verifyLineVisibleForProduct(bottle)
    await verifyLineVisibleForProduct(keg)
  })
})
