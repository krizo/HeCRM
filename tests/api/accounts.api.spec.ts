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
  test('distributor appears in distributor filter and stays out of retail filter', async ({
    api,
    data,
  }) => {
    const ctx = { api, data }

    const distributor = await createDistributor(ctx, { name: `Dist — Warsaw ${Date.now()}` })

    await verifyAccountIsInFilter(ctx, distributor, 'distributor')
    await verifyAccountIsNotInFilter(ctx, distributor, 'retail')
  })

  test('retail account is parented to its distributor and the link survives refetch', async ({
    api,
    data,
  }) => {
    const ctx = { api, data }

    const distributor = await createDistributor(ctx, { name: `Parent Dist ${Date.now()}` })
    const retail = await createRetailUnderDistributor(ctx, distributor, {
      name: `Child Retail ${Date.now()}`,
    })
    const refetched = await fetchAccountById(ctx, retail.id)

    await verifyAccountHasParent(ctx, refetched, distributor)
  })

  test('retail account never leaks into the distributor filter', async ({ api, data }) => {
    const ctx = { api, data }

    const distributor = await createDistributor(ctx)
    const retail = await createRetailUnderDistributor(ctx, distributor)

    await verifyAccountIsInFilter(ctx, retail, 'retail')
    await verifyAccountIsNotInFilter(ctx, retail, 'distributor')
  })

  test('name substring search surfaces a freshly created account', async ({ api, data }) => {
    const ctx = { api, data }
    const uniqueTag = `Tag${Date.now()}`

    const distributor = await createDistributor(ctx, { name: `${uniqueTag} Warehouse Group` })

    await verifySearchFindsAccount(ctx, uniqueTag, distributor)
  })
})
