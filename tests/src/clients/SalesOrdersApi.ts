import { ApiClient } from './ApiClient.js'
import type { SalesOrder, SalesOrderCreate, SalesOrderLine, SalesOrderLineCreate } from './types.js'

export class SalesOrdersApi extends ApiClient {
  async list(params?: { customer_id?: string; top?: number }): Promise<SalesOrder[]> {
    return this.get<SalesOrder[]>('/salesorders', {
      top: params?.top ?? 100,
      customer_id: params?.customer_id,
    })
  }

  async getById(id: string): Promise<SalesOrder> {
    return this.get<SalesOrder>(`/salesorders/${id}`)
  }

  async create(data: SalesOrderCreate): Promise<SalesOrder> {
    return this.post<SalesOrder>('/salesorders', data)
  }

  async delete(id: string): Promise<void> {
    await this.del(`/salesorders/${id}`)
  }

  async listLines(orderId: string): Promise<SalesOrderLine[]> {
    return this.get<SalesOrderLine[]>(`/salesorders/${orderId}/lines`)
  }

  async addLine(orderId: string, data: SalesOrderLineCreate): Promise<SalesOrderLine> {
    return this.post<SalesOrderLine>(`/salesorders/${orderId}/lines`, data)
  }

  async deleteLine(orderId: string, lineId: string): Promise<void> {
    await this.del(`/salesorders/${orderId}/lines/${lineId}`)
  }
}
