import { test } from '../src/fixtures/baseFixture.js'
import {
  createDistributor,
  createRetailUnderDistributor,
  fetchAccountById,
  verifyAccountHasParent,
  verifyAccountIsInFilter,
  verifyAccountIsNotInFilter,
  verifySearchFindsAccount,
} from '../src/journeys/accountSteps.js'

test.describe('Accounts journey', () => {
  test('distributor appears in distributor filter and stays out of retail filter', async () => {
    const distributor = await createDistributor({ name: `Dist — Warsaw ${Date.now()}` })

    await verifyAccountIsInFilter(distributor, 'distributor')
    await verifyAccountIsNotInFilter(distributor, 'retail')
  })

  test('retail account is parented to its distributor and the link survives refetch', async () => {
    const distributor = await createDistributor({ name: `Parent Dist ${Date.now()}` })
    const retail = await createRetailUnderDistributor(distributor, {
      name: `Child Retail ${Date.now()}`,
    })
    const refetched = await fetchAccountById(retail.id)

    await verifyAccountHasParent(refetched, distributor)
  })

  test('retail account never leaks into the distributor filter', async () => {
    const distributor = await createDistributor()
    const retail = await createRetailUnderDistributor(distributor)

    await verifyAccountIsInFilter(retail, 'retail')
    await verifyAccountIsNotInFilter(retail, 'distributor')
  })

  test('name substring search surfaces a freshly created account', async () => {
    const uniqueTag = `Tag${Date.now()}`
    const distributor = await createDistributor({ name: `${uniqueTag} Warehouse Group` })

    await verifySearchFindsAccount(uniqueTag, distributor)
  })
})
