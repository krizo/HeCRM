import { expect, test } from '../fixtures/baseFixture.js'
import { getApi, getData } from '../context.js'
import type { Account, AccountCreate, CustomerType } from '../clients/types.js'

// ---------------------------------------------------------------------------
// Atomic steps. Each takes only business parameters — api / data / logger are
// pulled from the ambient AsyncLocalStorage context, not passed in.
// ---------------------------------------------------------------------------

function uniqueSuffix(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

// Dataverse `accountnumber` is capped at 20 chars — keep our marker compact.
function shortAccountNumber(kind: 'D' | 'R', suffix: string): string {
  const tail = suffix.replace('-', '').slice(-10).toUpperCase()
  return `HECRM-T${kind}-${tail}`.slice(0, 20)
}

export async function createAccount(payload: AccountCreate): Promise<Account> {
  return test.step(`create ${payload.customer_type} "${payload.name}"`, async () => {
    const created = await getApi().accounts.create(payload)
    getData().track('account', created.id, created.name)
    expect(created.id, 'new account must have a GUID').toBeTruthy()
    expect(created.name).toBe(payload.name)
    expect(created.customer_type).toBe(payload.customer_type)
    return created
  })
}

export async function createDistributor(
  opts: { name?: string; city?: string } = {},
): Promise<Account> {
  const suffix = uniqueSuffix()
  return createAccount({
    name: opts.name ?? `Test Distributor ${suffix}`,
    customer_type: 'distributor',
    account_number: shortAccountNumber('D', suffix),
    city: opts.city ?? 'Warszawa',
    country: 'Poland',
  })
}

export async function createRetailUnderDistributor(
  distributor: Account,
  opts: { name?: string; city?: string } = {},
): Promise<Account> {
  const suffix = uniqueSuffix()
  return createAccount({
    name: opts.name ?? `Test Retail ${suffix}`,
    customer_type: 'retail',
    account_number: shortAccountNumber('R', suffix),
    parent_account_id: distributor.id,
    city: opts.city ?? 'Kraków',
    country: 'Poland',
  })
}

export async function fetchAccountById(id: string): Promise<Account> {
  return test.step(`fetch account by id ${id.slice(0, 8)}…`, async () => {
    const account = await getApi().accounts.getById(id)
    expect(account.id).toBe(id)
    return account
  })
}

export async function verifyAccountIsInFilter(
  account: Account,
  customerType: CustomerType,
): Promise<void> {
  return test.step(`account "${account.name}" appears in ${customerType} filter`, async () => {
    const rows = await getApi().accounts.list({ customer_type: customerType })
    expect(
      rows.find((a) => a.id === account.id),
      `account ${account.name} must appear in ${customerType} filter`,
    ).toBeDefined()
  })
}

export async function verifyAccountIsNotInFilter(
  account: Account,
  customerType: CustomerType,
): Promise<void> {
  return test.step(`account "${account.name}" does NOT appear in ${customerType} filter`, async () => {
    const rows = await getApi().accounts.list({ customer_type: customerType })
    expect(
      rows.find((a) => a.id === account.id),
      `${account.customer_type} account ${account.name} must not leak into ${customerType} filter`,
    ).toBeUndefined()
  })
}

export async function verifyAccountHasParent(
  account: Account,
  expectedParent: Account,
): Promise<void> {
  return test.step(`account "${account.name}" has parent "${expectedParent.name}"`, async () => {
    const refetched = await getApi().accounts.getById(account.id)
    expect(refetched.parent_account_id, 'parent distributor link must be set').toBe(expectedParent.id)
  })
}

export async function verifySearchFindsAccount(
  searchTerm: string,
  expectedAccount: Account,
): Promise<void> {
  return test.step(`search "${searchTerm}" finds account "${expectedAccount.name}"`, async () => {
    const rows = await getApi().accounts.list({ search: searchTerm })
    expect(
      rows.find((a) => a.id === expectedAccount.id),
      `search "${searchTerm}" must find ${expectedAccount.name}`,
    ).toBeDefined()
  })
}
