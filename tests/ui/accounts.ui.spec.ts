import { test } from '../src/fixtures/uiFixture.js'
import { createDistributor, createRetailUnderDistributor } from '../src/journeys/accountSteps.js'
import {
  filterAccountsByType,
  openAccountFromListByName,
  openAccountsPage,
  searchAccountsByText,
  verifyAccountDetailHeading,
  verifyAccountHiddenInList,
  verifyAccountVisibleInList,
  verifyRetailChildListedOnDetail,
} from '../src/journeys/accountUiSteps.js'

test.describe('Accounts UI journey', () => {
  test('newly created distributor is visible in the Distributors tab', async () => {
    const distributor = await createDistributor({ name: `UI Dist ${Date.now()}` })

    await openAccountsPage()
    await filterAccountsByType('distributor')
    await verifyAccountVisibleInList(distributor)
  })

  test('retail account appears in Retail tab and stays out of Distributors tab', async () => {
    const distributor = await createDistributor({ name: `UI Parent ${Date.now()}` })
    const retail = await createRetailUnderDistributor(distributor, { name: `UI Child ${Date.now()}` })

    await openAccountsPage()

    await filterAccountsByType('retail')
    await verifyAccountVisibleInList(retail)

    await filterAccountsByType('distributor')
    await verifyAccountHiddenInList(retail)
  })

  test('distributor detail page lists its child retail account', async () => {
    const distributor = await createDistributor({ name: `UI Parent Detail ${Date.now()}` })
    const retail = await createRetailUnderDistributor(distributor, {
      name: `UI Child Detail ${Date.now()}`,
    })

    await openAccountsPage()
    await filterAccountsByType('distributor')
    await openAccountFromListByName(distributor)

    await verifyAccountDetailHeading(distributor)
    await verifyRetailChildListedOnDetail(retail)
  })

  test('substring search surfaces the matching account', async () => {
    const tag = `UiTag${Date.now()}`
    const distributor = await createDistributor({ name: `${tag} Warehouse` })

    await openAccountsPage()
    await searchAccountsByText(tag)
    await verifyAccountVisibleInList(distributor)
  })
})
