import { test } from '../src/fixtures/baseFixture.js'
import {
  establishDistributor,
  onboardRetailUnderDistributor,
  searchAccountsByName,
  verifyDistributorFilterExcludes,
} from '../src/journeys/accountSteps.js'

test.describe('Accounts journey', () => {
  test('establishing a new distributor makes it visible in the distributor filter', async ({ api, data }) => {
    await establishDistributor({ api, data }, { name: `Test Dist — Pipeline ${Date.now()}`, city: 'Wrocław' })
  })

  test('a retail account can be onboarded under a distributor and stays there on refetch', async ({ api, data }) => {
    const ctx = { api, data }
    const distributor = await establishDistributor(ctx, { name: `Parent Dist ${Date.now()}` })
    await onboardRetailUnderDistributor(ctx, distributor, { name: `Child Retail ${Date.now()}` })
  })

  test('retail accounts never leak into the distributor filter', async ({ api, data }) => {
    const ctx = { api, data }
    const distributor = await establishDistributor(ctx)
    const retail = await onboardRetailUnderDistributor(ctx, distributor)
    await verifyDistributorFilterExcludes(ctx, retail)
  })

  test('name substring search surfaces a previously created account', async ({ api, data }) => {
    const ctx = { api, data }
    const tag = `Unique${Date.now()}`
    await establishDistributor(ctx, { name: `${tag} Warehouse Group` })
    await searchAccountsByName(ctx, tag, tag)
  })
})
