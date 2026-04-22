import { getPage } from '../context.js'
import type { CustomerType } from '../clients/types.js'

/**
 * Page Object for `/accounts`.
 *
 * Kept as a namespace of locator factories + URL constants — POs don't
 * hold per-test state, so exposing them as a module-level object is
 * simpler than instantiating a class per step.
 */
export const accountsPage = {
  path: '/accounts',
  testId: 'accounts-page',

  async goto(): Promise<void> {
    const page = getPage()
    await page.goto(this.path)
    await page.getByTestId(this.testId).waitFor({ state: 'visible' })
  },

  root() {
    return getPage().getByTestId(this.testId)
  },

  search() {
    return getPage().getByTestId('accounts-search')
  },

  filterTab(filter: 'all' | CustomerType) {
    return getPage().getByTestId(`accounts-filter-${filter}`)
  },

  table() {
    return getPage().getByTestId('accounts-table')
  },

  rowByName(name: string) {
    // Each row has the account name as the first cell — pick the tr that
    // contains the exact text.
    return this.table().locator('tbody tr').filter({ hasText: name })
  },
}
