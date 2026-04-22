import { expect, test } from '../fixtures/uiFixture.js'
import { accountDetailPage } from '../pages/AccountDetailPage.js'
import { accountsPage } from '../pages/AccountsPage.js'
import type { Account, CustomerType } from '../clients/types.js'

// ---------------------------------------------------------------------------
// Atomic UI steps. Business parameters only; page comes from ambient context.
// ---------------------------------------------------------------------------

export async function openAccountsPage(): Promise<void> {
  return test.step('open /accounts', async () => {
    await accountsPage.goto()
  })
}

export async function filterAccountsByType(filter: 'all' | CustomerType): Promise<void> {
  return test.step(`click accounts filter tab → ${filter}`, async () => {
    await accountsPage.filterTab(filter).click()
  })
}

export async function searchAccountsByText(query: string): Promise<void> {
  return test.step(`type "${query}" into accounts search`, async () => {
    const input = accountsPage.search()
    await input.fill(query)
  })
}

export async function openAccountFromListByName(account: Account): Promise<void> {
  return test.step(`click account row "${account.name}"`, async () => {
    await accountsPage.rowByName(account.name).getByRole('link').click()
    await accountDetailPage.root().waitFor({ state: 'visible' })
  })
}

// ---------------------------------------------------------------------------
// Atomic UI verifications
// ---------------------------------------------------------------------------

export async function verifyAccountVisibleInList(account: Account): Promise<void> {
  return test.step(`account "${account.name}" is visible in the accounts table`, async () => {
    await expect(accountsPage.rowByName(account.name)).toBeVisible()
  })
}

export async function verifyAccountHiddenInList(account: Account): Promise<void> {
  return test.step(`account "${account.name}" is NOT visible in the accounts table`, async () => {
    await expect(accountsPage.rowByName(account.name)).toHaveCount(0)
  })
}

export async function verifyAccountDetailHeading(account: Account): Promise<void> {
  return test.step(`account detail heading shows "${account.name}"`, async () => {
    await expect(accountDetailPage.heading()).toHaveText(account.name)
  })
}

export async function verifyRetailChildListedOnDetail(retail: Account): Promise<void> {
  return test.step(`retail child "${retail.name}" is listed on the distributor's detail page`, async () => {
    await expect(accountDetailPage.retailChildByName(retail.name)).toBeVisible()
  })
}
