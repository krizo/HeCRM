import type { APIRequestContext } from '@playwright/test'
import type { TestConfig } from '../config/types.js'
import type { Logger } from '../logger/Logger.js'
import { AccountsApi } from './AccountsApi.js'
import { ContactsApi } from './ContactsApi.js'
import { OpportunitiesApi } from './OpportunitiesApi.js'
import { ProductsApi } from './ProductsApi.js'
import { SalesOrdersApi } from './SalesOrdersApi.js'

/**
 * Single aggregator exposing every endpoint-specific client under one roof.
 * Journey steps take this and call e.g. `api.accounts.create(...)`.
 */
export class HeCrmApi {
  readonly accounts: AccountsApi
  readonly contacts: ContactsApi
  readonly products: ProductsApi
  readonly opportunities: OpportunitiesApi
  readonly salesorders: SalesOrdersApi

  constructor(request: APIRequestContext, config: TestConfig, logger: Logger) {
    const opts = { baseUrl: config.api.baseUrl, logger: logger.child('api'), request }
    this.accounts = new AccountsApi(opts)
    this.contacts = new ContactsApi(opts)
    this.products = new ProductsApi(opts)
    this.opportunities = new OpportunitiesApi(opts)
    this.salesorders = new SalesOrdersApi(opts)
  }
}
