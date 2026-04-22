import { expect, test } from '../fixtures/baseFixture.js'
import type { HeCrmApi } from '../clients/HeCrmApi.js'
import type { DataCollector } from '../fixtures/DataCollector.js'
import type { Account, AccountCreate, CustomerType } from '../clients/types.js'

export interface Ctx {
  readonly api: HeCrmApi
  readonly data: DataCollector
}

function uniqueSuffix(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

// Dataverse `accountnumber` is capped at 20 chars — keep our test marker compact.
// Names stay long & human-readable for debugging; numbers are for indexing only.
function shortAccountNumber(kind: 'D' | 'R', suffix: string): string {
  const tail = suffix.replace('-', '').slice(-10).toUpperCase()
  return `HECRM-T${kind}-${tail}`.slice(0, 20)
}

// ------------------------------------------------------------------
// Atomic steps — one API call + focused assertions
// ------------------------------------------------------------------

export async function createAccount(
  { api, data }: Ctx,
  payload: AccountCreate & { name: string },
): Promise<Account> {
  return test.step(`create ${payload.customer_type} account "${payload.name}"`, async () => {
    const created = await api.accounts.create(payload)
    data.track('account', created.id, created.name)
    expect(created.id, 'created account must have an id').toBeTruthy()
    expect(created.name).toBe(payload.name)
    expect(created.customer_type).toBe(payload.customer_type)
    return created
  })
}

export async function fetchAccountById(
  { api }: Ctx,
  id: string,
): Promise<Account> {
  return test.step(`fetch account by id`, async () => {
    const account = await api.accounts.getById(id)
    expect(account.id).toBe(id)
    return account
  })
}

export async function listAccountsOfType(
  { api }: Ctx,
  customerType: CustomerType,
): Promise<Account[]> {
  return test.step(`list accounts of type=${customerType}`, async () => {
    const rows = await api.accounts.list({ customer_type: customerType })
    for (const row of rows) {
      expect(row.customer_type, `row ${row.name} must match filter`).toBe(customerType)
    }
    return rows
  })
}

export async function deleteAccount({ api }: Ctx, id: string): Promise<void> {
  return test.step(`delete account ${id.slice(0, 8)}…`, async () => {
    await api.accounts.delete(id)
  })
}

// ------------------------------------------------------------------
// Compound steps — business processes, one or more atomics + checks
// ------------------------------------------------------------------

export async function establishDistributor(
  ctx: Ctx,
  opts: { name?: string; city?: string } = {},
): Promise<Account> {
  return test.step('establish a new distributor', async () => {
    const suffix = uniqueSuffix()
    const created = await createAccount(ctx, {
      name: opts.name ?? `Test Distributor ${suffix}`,
      customer_type: 'distributor',
      account_number: shortAccountNumber('D', suffix),
      city: opts.city ?? 'Warszawa',
      country: 'Poland',
    })
    const listed = await listAccountsOfType(ctx, 'distributor')
    expect(listed.some((a) => a.id === created.id), 'new distributor appears in distributor list').toBe(true)
    return created
  })
}

export async function onboardRetailUnderDistributor(
  ctx: Ctx,
  distributor: Account,
  opts: { name?: string; city?: string } = {},
): Promise<Account> {
  return test.step(`onboard retail account under "${distributor.name}"`, async () => {
    const suffix = uniqueSuffix()
    const created = await createAccount(ctx, {
      name: opts.name ?? `Test Retail ${suffix}`,
      customer_type: 'retail',
      account_number: shortAccountNumber('R', suffix),
      parent_account_id: distributor.id,
      city: opts.city ?? 'Kraków',
      country: 'Poland',
    })
    const refetched = await fetchAccountById(ctx, created.id)
    expect(refetched.parent_account_id, 'retail account keeps parent distributor link').toBe(distributor.id)
    return refetched
  })
}

export async function verifyDistributorFilterExcludes(
  ctx: Ctx,
  retail: Account,
): Promise<void> {
  return test.step('distributor filter must not return retail accounts', async () => {
    const distributors = await listAccountsOfType(ctx, 'distributor')
    expect(
      distributors.find((a) => a.id === retail.id),
      `retail account ${retail.name} must not leak into distributor list`,
    ).toBeUndefined()
  })
}

export async function searchAccountsByName(
  ctx: Ctx,
  substring: string,
  expectContains: string,
): Promise<void> {
  return test.step(`search accounts by name "${substring}" returns hit containing "${expectContains}"`, async () => {
    const rows = await ctx.api.accounts.list({ search: substring })
    const match = rows.find((a) => a.name.includes(expectContains))
    expect(match, `at least one account must include "${expectContains}"`).toBeDefined()
  })
}
