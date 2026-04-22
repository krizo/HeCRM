import { ApiClient } from './ApiClient.js'
import type { Contact, ContactCreate } from './types.js'

export class ContactsApi extends ApiClient {
  async list(params?: { account_id?: string; search?: string; top?: number }): Promise<Contact[]> {
    return this.get<Contact[]>('/contacts', {
      top: params?.top ?? 100,
      account_id: params?.account_id,
      search: params?.search,
    })
  }

  async getById(id: string): Promise<Contact> {
    return this.get<Contact>(`/contacts/${id}`)
  }

  async create(data: ContactCreate): Promise<Contact> {
    return this.post<Contact>('/contacts', data)
  }

  async delete(id: string): Promise<void> {
    await this.del(`/contacts/${id}`)
  }
}
