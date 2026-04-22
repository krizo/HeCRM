import { getPage } from '../context.js'

export const accountDetailPage = {
  testId: 'account-detail',

  async goto(accountId: string): Promise<void> {
    const page = getPage()
    await page.goto(`/accounts/${accountId}`)
    await page.getByTestId(this.testId).waitFor({ state: 'visible' })
  },

  root() {
    return getPage().getByTestId(this.testId)
  },

  heading() {
    return this.root().locator('h1')
  },

  // The child-retail list is inside a Card titled "Retail accounts under
  // this distributor" — pick items by their rendered name.
  retailChildByName(name: string) {
    return this.root().locator('li').filter({ hasText: name })
  },

  contactByFullName(fullName: string) {
    return this.root().locator('li').filter({ hasText: fullName })
  },
}
