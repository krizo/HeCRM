import { expect, test } from '../fixtures/dataverseFixture.js'
import { getDv, getDvData } from '../context.js'
import type { RawResponse, TokenInfo } from '../clients/DataverseRawClient.js'

// ---------------------------------------------------------------------------
// Atomic steps for the `dataverse` Playwright project. They talk directly to
// the Dataverse Web API — no FastAPI, no HeCrmApi, no schemas. Every step is
// one raw HTTP call (OData) or MSAL interaction + one focused assertion,
// wrapped in test.step().
// ---------------------------------------------------------------------------

function uniq(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`.toUpperCase()
}

// --- Auth ------------------------------------------------------------------

export async function acquireClientCredentialToken(): Promise<TokenInfo> {
  return test.step('acquire client-credentials token from Entra', async () => {
    const info = await getDv().acquireToken()
    expect(info.accessToken, 'access token must be a non-empty string').toBeTruthy()
    expect(info.accessToken.length).toBeGreaterThan(32)
    return info
  })
}

export async function verifyTokenHasFutureExpiry(info: TokenInfo): Promise<void> {
  return test.step('token expiry is in the future (within a sensible window)', async () => {
    expect(info.expiresOn, 'MSAL must report an expiresOn').toBeTruthy()
    const expiresMs = info.expiresOn!.getTime()
    const nowMs = Date.now()
    expect(expiresMs, 'token must expire later than now').toBeGreaterThan(nowMs)
    expect(expiresMs - nowMs, 'token must expire within 2h (Entra default is 1h)').toBeLessThan(
      2 * 60 * 60 * 1000,
    )
  })
}

// --- Schema / query --------------------------------------------------------

export async function verifyEntityDefinitionHasAttributes(
  logicalName: string,
  expectedAttributes: readonly string[],
): Promise<void> {
  return test.step(
    `entity "${logicalName}" exposes attributes: ${expectedAttributes.join(', ')}`,
    async () => {
      const response = await getDv().get<{ value: Array<{ LogicalName: string }> }>(
        `/EntityDefinitions(LogicalName='${logicalName}')/Attributes`,
        { $select: 'LogicalName', $top: 500 },
      )
      expect(response.status, `${logicalName} metadata must be readable`).toBe(200)
      const names = new Set((response.body?.value ?? []).map((a) => a.LogicalName))
      for (const expected of expectedAttributes) {
        expect(names.has(expected), `${logicalName}.${expected} missing from metadata`).toBe(true)
      }
    },
  )
}

export async function queryEntitySet(
  entitySet: string,
  params: Record<string, string> = {},
): Promise<RawResponse<{ '@odata.context': string; value: unknown[] }>> {
  return test.step(`OData GET /${entitySet} with ${JSON.stringify(params)}`, async () => {
    const response = await getDv().get<{ '@odata.context': string; value: unknown[] }>(
      `/${entitySet}`,
      params,
    )
    expect(response.status).toBe(200)
    return response
  })
}

export async function verifyODataCollectionShape(
  response: RawResponse<{ '@odata.context': string; value: unknown[] }>,
): Promise<void> {
  return test.step('response has @odata.context + value[] — canonical OData collection shape', async () => {
    expect(response.body, 'body must be present').toBeTruthy()
    expect(response.body!['@odata.context'], '@odata.context must be a URL to metadata').toMatch(
      /\$metadata#/,
    )
    expect(Array.isArray(response.body!.value), 'value must be an array').toBe(true)
  })
}

// --- CRUD + @odata.bind ----------------------------------------------------

export async function createRawAccount(label: string): Promise<string> {
  return test.step(`POST /accounts { name: "${label}" } returns 201 + Location + body`, async () => {
    const response = await getDv().post<{ accountid: string }>(
      '/accounts',
      { name: label, customertypecode: 3 },
      { Prefer: 'return=representation' },
    )
    expect(response.status).toBe(201)
    expect(response.body?.accountid, 'return=representation body must include accountid').toBeTruthy()
    const id = response.body!.accountid
    getDvData().track('accounts', id, label)
    return id
  })
}

export async function createRawAccountWithParent(
  label: string,
  parentAccountId: string,
): Promise<string> {
  return test.step(
    `POST /accounts { …, parentaccountid@odata.bind } returns 201 with link resolved`,
    async () => {
      const response = await getDv().post<{ accountid: string; _parentaccountid_value: string }>(
        '/accounts',
        {
          name: label,
          customertypecode: 3,
          'parentaccountid@odata.bind': `/accounts(${parentAccountId})`,
        },
        { Prefer: 'return=representation' },
      )
      expect(response.status).toBe(201)
      expect(
        response.body?._parentaccountid_value,
        'parent link must be readable as _parentaccountid_value on the returned row',
      ).toBe(parentAccountId)
      const id = response.body!.accountid
      getDvData().track('accounts', id, label)
      return id
    },
  )
}

export async function verifyChildRefetchShowsParent(
  childId: string,
  parentId: string,
): Promise<void> {
  return test.step(`refetch child reveals _parentaccountid_value = parent`, async () => {
    const response = await getDv().get<{ _parentaccountid_value: string }>(
      `/accounts(${childId})`,
      { $select: '_parentaccountid_value' },
    )
    expect(response.status).toBe(200)
    expect(response.body?._parentaccountid_value).toBe(parentId)
  })
}

export async function createContactWithAccountBind(
  accountId: string,
): Promise<string> {
  return test.step(
    `POST /contacts with parentcustomerid_account@odata.bind succeeds`,
    async () => {
      const response = await getDv().post<{ contactid: string }>(
        '/contacts',
        {
          firstname: 'DV',
          lastname: `Test ${uniq()}`,
          'parentcustomerid_account@odata.bind': `/accounts(${accountId})`,
        },
        { Prefer: 'return=representation' },
      )
      expect(response.status).toBe(201)
      const id = response.body!.contactid
      getDvData().track('contacts', id, 'DV polymorphic-bind contact')
      return id
    },
  )
}

export async function verifyPolymorphicBindWithoutSuffixIsRejected(
  accountId: string,
): Promise<void> {
  return test.step(
    `POST /contacts with plain parentcustomerid@odata.bind (no _account suffix) → 400/4xx`,
    async () => {
      const response = await getDv().post(
        '/contacts',
        {
          firstname: 'DV',
          lastname: `Should fail ${uniq()}`,
          'parentcustomerid@odata.bind': `/accounts(${accountId})`,
        },
      )
      expect(
        response.status,
        'polymorphic customer fields MUST disambiguate via _account/_contact suffix',
      ).toBeGreaterThanOrEqual(400)
      expect(response.status).toBeLessThan(500)
    },
  )
}

// --- Unbound actions -------------------------------------------------------

export async function createRawOpportunity(
  accountId: string,
  label: string,
): Promise<string> {
  return test.step(`POST /opportunities against account ${accountId.slice(0, 8)}…`, async () => {
    const response = await getDv().post<{ opportunityid: string }>(
      '/opportunities',
      {
        name: label,
        'customerid_account@odata.bind': `/accounts(${accountId})`,
        estimatedvalue: 1000,
      },
      { Prefer: 'return=representation' },
    )
    expect(response.status).toBe(201)
    const id = response.body!.opportunityid
    getDvData().track('opportunities', id, label)
    return id
  })
}

export async function invokeWinOpportunity(opportunityId: string): Promise<void> {
  return test.step(`invoke unbound action /WinOpportunity on ${opportunityId.slice(0, 8)}…`, async () => {
    const response = await getDv().post('/WinOpportunity', {
      Status: 3,
      OpportunityClose: {
        subject: 'Won by Dataverse contract test',
        'opportunityid@odata.bind': `/opportunities(${opportunityId})`,
      },
    })
    expect(response.status, 'WinOpportunity returns 204 No Content on success').toBe(204)
  })
}

export async function verifyOpportunityStatecode(
  opportunityId: string,
  expected: number,
): Promise<void> {
  return test.step(`opportunity statecode = ${expected}`, async () => {
    const response = await getDv().get<{ statecode: number }>(
      `/opportunities(${opportunityId})`,
      { $select: 'statecode' },
    )
    expect(response.status).toBe(200)
    expect(response.body?.statecode).toBe(expected)
  })
}

// --- Error envelope --------------------------------------------------------

export async function verifyMissingResourceReturns404(
  entitySet: string,
  nonExistentId = '00000000-0000-0000-0000-000000000000',
): Promise<void> {
  return test.step(
    `GET /${entitySet}(${nonExistentId}) → 404 with canonical error envelope`,
    async () => {
      const response = await getDv().get<{ error: { code: string; message: string } }>(
        `/${entitySet}(${nonExistentId})`,
      )
      expect(response.status).toBe(404)
      expect(response.body?.error, 'body must wrap the failure in { error: { ... } }').toBeTruthy()
      expect(response.body?.error.code, 'error.code must be a Dataverse hex code (0x…)').toMatch(
        /^0x[0-9a-fA-F]+$/,
      )
      expect(typeof response.body?.error.message).toBe('string')
    },
  )
}
