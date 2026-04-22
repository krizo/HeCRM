import { getPage } from '../context.js'

export const salesOrdersPage = {
  path: '/salesorders',
  testId: 'salesorders-page',

  async goto(): Promise<void> {
    const page = getPage()
    await page.goto(this.path)
    await page.getByTestId(this.testId).waitFor({ state: 'visible' })
  },

  table() {
    return getPage().getByTestId('salesorders-table')
  },

  rowByName(name: string) {
    return this.table().locator('tbody tr').filter({ hasText: name })
  },
}

export const salesOrderDetailPage = {
  testId: 'salesorder-detail',

  async goto(orderId: string): Promise<void> {
    const page = getPage()
    await page.goto(`/salesorders/${orderId}`)
    await page.getByTestId(this.testId).waitFor({ state: 'visible' })
  },

  root() {
    return getPage().getByTestId(this.testId)
  },

  linesTable() {
    return getPage().getByTestId('salesorder-lines-table')
  },

  lineRowByProduct(productName: string) {
    return this.linesTable().locator('tbody tr').filter({ hasText: productName })
  },
}
