import { ApiClient } from './ApiClient.js'
import type { Opportunity, OpportunityCreate, OpportunityStage } from './types.js'

export class OpportunitiesApi extends ApiClient {
  async list(params?: {
    customer_id?: string
    stage?: OpportunityStage
    open_only?: boolean
    top?: number
  }): Promise<Opportunity[]> {
    return this.get<Opportunity[]>('/opportunities', {
      top: params?.top ?? 100,
      customer_id: params?.customer_id,
      stage: params?.stage,
      open_only: params?.open_only,
    })
  }

  async getById(id: string): Promise<Opportunity> {
    return this.get<Opportunity>(`/opportunities/${id}`)
  }

  async create(data: OpportunityCreate): Promise<Opportunity> {
    return this.post<Opportunity>('/opportunities', data)
  }

  async setStage(id: string, stage: Exclude<OpportunityStage, 'won' | 'lost'>): Promise<Opportunity> {
    return this.patch<Opportunity>(`/opportunities/${id}`, { stage })
  }

  async win(id: string, subject = 'Won via test suite'): Promise<Opportunity> {
    return this.post<Opportunity>(`/opportunities/${id}/win`, { subject })
  }

  async lose(id: string, subject = 'Lost via test suite'): Promise<Opportunity> {
    return this.post<Opportunity>(`/opportunities/${id}/lose`, { subject })
  }

  async delete(id: string): Promise<void> {
    await this.del(`/opportunities/${id}`)
  }
}
