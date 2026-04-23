import { test } from '../src/fixtures/dataverseFixture.js'
import {
  createContactWithAccountBind,
  createRawAccount,
  createRawAccountWithParent,
  verifyChildRefetchShowsParent,
  verifyPolymorphicBindWithoutSuffixIsRejected,
} from '../src/journeys/dataverseSteps.js'

test.describe('Dataverse @odata.bind contract', () => {
  test('parentaccountid@odata.bind creates a link readable as _parentaccountid_value', async () => {
    const parentId = await createRawAccount(`DV Parent ${Date.now()}`)
    const childId = await createRawAccountWithParent(`DV Child ${Date.now()}`, parentId)

    await verifyChildRefetchShowsParent(childId, parentId)
  })

  test('customer polymorphic fields accept _account suffix', async () => {
    const accountId = await createRawAccount(`DV Polymorphic ${Date.now()}`)
    await createContactWithAccountBind(accountId)
  })

  test('customer polymorphic fields reject a plain @odata.bind (no suffix)', async () => {
    const accountId = await createRawAccount(`DV BadBind ${Date.now()}`)
    await verifyPolymorphicBindWithoutSuffixIsRejected(accountId)
  })
})
