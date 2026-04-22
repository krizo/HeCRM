import { ApiClient } from './ApiClient.js'
import type { Product } from './types.js'

export interface UnitInfo {
  schedule_id: string
  schedule_name: string
  unit_id: string
  unit_name: string
}

export class ProductsApi extends ApiClient {
  async list(params?: { active_only?: boolean; search?: string; top?: number }): Promise<Product[]> {
    return this.get<Product[]>('/products', {
      top: params?.top ?? 100,
      active_only: params?.active_only ?? true,
      search: params?.search,
    })
  }

  async getById(id: string): Promise<Product> {
    return this.get<Product>(`/products/${id}`)
  }

  async units(): Promise<UnitInfo[]> {
    return this.get<UnitInfo[]>('/products/units')
  }
}
