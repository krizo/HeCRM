export type CustomerType = 'retail' | 'distributor'

export interface Account {
  id: string
  name: string
  account_number: string | null
  customer_type: CustomerType
  email: string | null
  phone: string | null
  website: string | null
  city: string | null
  country: string | null
  parent_account_id: string | null
  created_on: string | null
  modified_on: string | null
}

export interface Contact {
  id: string
  first_name: string
  last_name: string
  full_name: string | null
  job_title: string | null
  email: string | null
  phone: string | null
  mobile: string | null
  city: string | null
  country: string | null
  account_id: string | null
  created_on: string | null
  modified_on: string | null
}

export type OpportunityStage =
  | 'prospecting'
  | 'developing'
  | 'proposing'
  | 'closing'
  | 'won'
  | 'lost'

export interface Opportunity {
  id: string
  name: string
  description: string | null
  estimated_value: number | null
  estimated_close_date: string | null
  stage: OpportunityStage
  customer_id: string | null
  created_on: string | null
  modified_on: string | null
}

export const PRODUCT_STATE_LABEL: Record<number, string> = {
  0: 'Active',
  1: 'Retired',
  2: 'Draft',
  3: 'Under Revision',
}

export interface Product {
  id: string
  name: string
  product_number: string
  description: string | null
  price: number | null
  cost: number | null
  state: number
  unit_id: string | null
  unit_schedule_id: string | null
  created_on: string | null
  modified_on: string | null
}

export const SALES_ORDER_STATE_LABEL: Record<number, string> = {
  0: 'Active',
  1: 'Submitted',
  2: 'Canceled',
  3: 'Fulfilled',
  4: 'Invoiced',
}

export interface SalesOrder {
  id: string
  name: string
  description: string | null
  order_number: string | null
  customer_id: string | null
  opportunity_id: string | null
  total_amount: number | null
  state: number
  created_on: string | null
  modified_on: string | null
}

export interface SalesOrderLine {
  id: string
  order_id: string
  product_id: string | null
  product_name: string | null
  quantity: number
  price_per_unit: number
  extended_amount: number | null
  unit_id: string | null
}
