import { expect, test } from '../fixtures/uiFixture.js'
import { salesOrderDetailPage, salesOrdersPage } from '../pages/SalesOrdersPage.js'
import type { Product, SalesOrder } from '../clients/types.js'

// ---------------------------------------------------------------------------
// Atomic UI steps
// ---------------------------------------------------------------------------

export async function openSalesOrdersPage(): Promise<void> {
  return test.step('open /salesorders', async () => {
    await salesOrdersPage.goto()
  })
}

export async function openSalesOrderDetailFromList(order: SalesOrder): Promise<void> {
  return test.step(`click sales-order row "${order.name}"`, async () => {
    await salesOrdersPage.rowByName(order.name).getByRole('link').click()
    await salesOrderDetailPage.root().waitFor({ state: 'visible' })
  })
}

// ---------------------------------------------------------------------------
// Atomic UI verifications
// ---------------------------------------------------------------------------

export async function verifySalesOrderVisibleInList(order: SalesOrder): Promise<void> {
  return test.step(`sales order "${order.name}" is listed`, async () => {
    await expect(salesOrdersPage.rowByName(order.name)).toBeVisible()
  })
}

export async function verifyOrderDetailShowsLineCount(expected: number): Promise<void> {
  return test.step(`detail page shows ${expected} line item(s) in the table`, async () => {
    await expect(salesOrderDetailPage.linesTable().locator('tbody tr')).toHaveCount(expected)
  })
}

export async function verifyLineVisibleForProduct(product: Product): Promise<void> {
  return test.step(`line item for "${product.name}" is visible`, async () => {
    await expect(salesOrderDetailPage.lineRowByProduct(product.name)).toBeVisible()
  })
}
