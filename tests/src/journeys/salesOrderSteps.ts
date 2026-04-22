import { expect, test } from '../fixtures/baseFixture.js'
import type {
  Account,
  Opportunity,
  Product,
  SalesOrder,
  SalesOrderLine,
} from '../clients/types.js'
import type { Ctx } from './accountSteps.js'

// ---------------------------------------------------------------------------
// Atomic steps only.
// ---------------------------------------------------------------------------

export async function createOrderHeader(
  { api, data }: Ctx,
  opts: {
    customer: Account
    opportunity?: Opportunity
    name?: string
    description?: string
  },
): Promise<SalesOrder> {
  const label = opts.name ?? `Test order — ${opts.customer.name}`
  return test.step(
    `create sales order header "${label}" for "${opts.customer.name}"` +
      (opts.opportunity ? ` from opportunity "${opts.opportunity.name}"` : ''),
    async () => {
      const order = await api.salesorders.create({
        name: label,
        customer_id: opts.customer.id,
        opportunity_id: opts.opportunity?.id,
        description: opts.description,
      })
      data.track('salesorder', order.id, order.name)
      expect(order.customer_id).toBe(opts.customer.id)
      if (opts.opportunity) {
        expect(order.opportunity_id, 'order must link back to its originating opportunity').toBe(
          opts.opportunity.id,
        )
      }
      return order
    },
  )
}

export async function pickActiveProduct(ctx: Ctx, search?: string): Promise<Product> {
  return test.step(`pick an active product${search ? ` matching "${search}"` : ''}`, async () => {
    const products = await ctx.api.products.list({ active_only: true, search })
    const chosen = products[0]
    expect(chosen, 'at least one active product must exist (did you run backend seed?)').toBeDefined()
    expect(chosen.unit_id, 'product must have a default unit of measure').toBeTruthy()
    return chosen
  })
}

export async function addOrderLine(
  { api, data }: Ctx,
  order: SalesOrder,
  product: Product,
  quantity: number,
  pricePerUnit: number,
): Promise<SalesOrderLine> {
  return test.step(
    `add line "${product.product_number}" × ${quantity} @ ${pricePerUnit} to order`,
    async () => {
      if (!product.unit_id) {
        throw new Error(`Product ${product.product_number} has no unit_id — can't create line item`)
      }
      const line = await api.salesorders.addLine(order.id, {
        product_id: product.id,
        quantity,
        price_per_unit: pricePerUnit,
        unit_id: product.unit_id,
      })
      data.track('salesorderline', line.id, `${product.product_number}×${quantity}`, order.id)
      expect(Number(line.quantity)).toBe(quantity)
      expect(Number(line.price_per_unit)).toBeCloseTo(pricePerUnit, 2)
      return line
    },
  )
}

export async function verifyOrderHasLineCount(
  { api }: Ctx,
  order: SalesOrder,
  expected: number,
): Promise<void> {
  return test.step(`order "${order.name}" has exactly ${expected} line item(s)`, async () => {
    const lines = await api.salesorders.listLines(order.id)
    expect(lines, `expected ${expected} lines on order ${order.id.slice(0, 8)}…`).toHaveLength(expected)
  })
}

export async function verifyOrderTotalMatches(
  { api }: Ctx,
  order: SalesOrder,
  expectedTotal: number,
): Promise<void> {
  return test.step(`order total matches ${expectedTotal.toFixed(2)}`, async () => {
    const refetched = await api.salesorders.getById(order.id)
    expect(
      Number(refetched.total_amount ?? 0),
      'order total_amount (Dataverse rollup) must match expected',
    ).toBeCloseTo(expectedTotal, 2)
  })
}

export async function verifyLinesSumMatches(
  { api }: Ctx,
  order: SalesOrder,
  expectedTotal: number,
): Promise<void> {
  return test.step(`sum of line extended_amount equals ${expectedTotal.toFixed(2)}`, async () => {
    const lines = await api.salesorders.listLines(order.id)
    const sum = lines.reduce((s, l) => s + Number(l.extended_amount ?? 0), 0)
    expect(sum, 'sum of extended_amount across all lines').toBeCloseTo(expectedTotal, 2)
  })
}
