import { ApiClient } from './ApiClient.js'
import type { Account, AccountCreate, AccountUpdate, CustomerType } from './types.js'

export class AccountsApi extends ApiClient {
  async list(params?: { customer_type?: CustomerType; search?: string; top?: number }): Promise<Account[]> {
    return this.get<Account[]>('/accounts', {
      top: params?.top ?? 100,
      customer_type: params?.customer_type,
      search: params?.search,
    })
  }

  async getById(id: string): Promise<Account> {
    return this.get<Account>(`/accounts/${id}`)
  }

  async create(data: AccountCreate): Promise<Account> {
    return this.post<Account>('/accounts', data)
  }

  async update(id: string, data: AccountUpdate): Promise<Account> {
    return this.patch<Account>(`/accounts/${id}`, data)
  }

  async delete(id: string): Promise<void> {
    await this.del(`/accounts/${id}`)
  }
}
