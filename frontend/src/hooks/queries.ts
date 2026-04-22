import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, qs } from '../lib/api'
import type {
  Account,
  Contact,
  Opportunity,
  OpportunityStage,
  Product,
  SalesOrder,
  SalesOrderLine,
} from '../lib/types'

// ---------- Accounts ----------

export function useAccounts(params?: { customer_type?: string; search?: string }) {
  return useQuery({
    queryKey: ['accounts', params ?? {}],
    queryFn: () => api.get<Account[]>(`/accounts${qs({ top: 200, ...params })}`),
  })
}

export function useAccount(id: string | undefined) {
  return useQuery({
    queryKey: ['account', id],
    queryFn: () => api.get<Account>(`/accounts/${id}`),
    enabled: !!id,
  })
}

// ---------- Contacts ----------

export function useContacts(params?: { account_id?: string; search?: string }) {
  return useQuery({
    queryKey: ['contacts', params ?? {}],
    queryFn: () => api.get<Contact[]>(`/contacts${qs({ top: 200, ...params })}`),
  })
}

// ---------- Opportunities ----------

export function useOpportunities(params?: {
  customer_id?: string
  stage?: OpportunityStage
  open_only?: boolean
}) {
  return useQuery({
    queryKey: ['opportunities', params ?? {}],
    queryFn: () => api.get<Opportunity[]>(`/opportunities${qs({ top: 200, ...params })}`),
  })
}

export function useWinOpportunity() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.post<Opportunity>(`/opportunities/${id}/win`, { subject: 'Won via HeCRM UI' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['opportunities'] }),
  })
}

export function useLoseOpportunity() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.post<Opportunity>(`/opportunities/${id}/lose`, { subject: 'Lost via HeCRM UI' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['opportunities'] }),
  })
}

export function useAdvanceOpportunityStage() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, stage }: { id: string; stage: OpportunityStage }) =>
      api.patch<Opportunity>(`/opportunities/${id}`, { stage }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['opportunities'] }),
  })
}

// ---------- Products ----------

export function useProducts(params?: { active_only?: boolean; search?: string }) {
  return useQuery({
    queryKey: ['products', params ?? {}],
    queryFn: () => api.get<Product[]>(`/products${qs({ top: 200, active_only: true, ...params })}`),
  })
}

// ---------- Sales orders ----------

export function useSalesOrders(params?: { customer_id?: string }) {
  return useQuery({
    queryKey: ['salesorders', params ?? {}],
    queryFn: () => api.get<SalesOrder[]>(`/salesorders${qs({ top: 200, ...params })}`),
  })
}

export function useSalesOrder(id: string | undefined) {
  return useQuery({
    queryKey: ['salesorder', id],
    queryFn: () => api.get<SalesOrder>(`/salesorders/${id}`),
    enabled: !!id,
  })
}

export function useSalesOrderLines(id: string | undefined) {
  return useQuery({
    queryKey: ['salesorder-lines', id],
    queryFn: () => api.get<SalesOrderLine[]>(`/salesorders/${id}/lines`),
    enabled: !!id,
  })
}
