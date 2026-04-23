import { test } from '../src/fixtures/dataverseFixture.js'
import {
  queryEntitySet,
  verifyEntityDefinitionHasAttributes,
  verifyODataCollectionShape,
} from '../src/journeys/dataverseSteps.js'

test.describe('Dataverse schema + query contract', () => {
  test('account entity exposes every attribute HeCRM reads or writes', async () => {
    await verifyEntityDefinitionHasAttributes('account', [
      'name',
      'accountnumber',
      'customertypecode',
      'parentaccountid',
      'emailaddress1',
      'telephone1',
      'websiteurl',
    ])
  })

  test('OData $select + $top returns the canonical collection envelope', async () => {
    const response = await queryEntitySet('accounts', { $select: 'name,accountid', $top: '3' })
    await verifyODataCollectionShape(response)
  })
})
