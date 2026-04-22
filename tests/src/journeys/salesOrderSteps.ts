import { expect, test } from '../fixtures/baseFixture.js'
import type {
  Account,
  Opportunity,
  Product,
  SalesOrder,
  SalesOrderLine,
} from '../clients/types.js'
import type { Ctx } from './accountSteps.js'

export interface LineSpec {
  readonly product: Product
  readonly quantity: number
  readonly pricePerUnit: number
}

function sumExpected(lines: readonly LineSpec[]): number {
  return lines.reduce((sum, l) => sum + l.quantity * l.pricePerUnit, 0)
}

// ------------------------------------------------------------------
// Atomic steps
// ------------------------------------------------------------------

export async function createOrderHeader(
  { api, data }: Ctx,
  opts: {
    customer: Account
    opportunity?: Opportunity
    name?: string
    description?: string
  },
): Promise<SalesOrder> {
  const { customer, opportunity, name, description } = opts
  return test.step(`create sales order header for "${customer.name}"`, async () => {
    const order = await api.salesorders.create({
      name: name ?? `Test order — ${customer.name}`,
      customer_id: customer.id,
      opportunity_id: opportunity?.id,
      description,
    })
    data.track('salesorder', order.id, order.name)
    expect(order.customer_id, 'order must reference the given customer').toBe(customer.id)
    if (opportunity) {
      expect(order.opportunity_id, 'order must link back to the opportunity').toBe(opportunity.id)
    }
    return order
  })
}

export async function addLineItem(
  { api, data }: Ctx,
  order: SalesOrder,
  line: LineSpec,
): Promise<SalesOrderLine> {
  return test.step(`add line: ${line.product.product_number} × ${line.quantity} @ ${line.pricePerUnit}`, async () => {
    if (!line.product.unit_id) {
      throw new Error(`Product ${line.product.product_number} has no unit_id — can't create line item`)
    }
    const created = await api.salesorders.addLine(order.id, {
      product_id: line.product.id,
      quantity: line.quantity,
      price_per_unit: line.pricePerUnit,
      unit_id: line.product.unit_id,
    })
    data.track('salesorderline', created.id, `${line.product.product_number}×${line.quantity}`, order.id)
    expect(Number(created.quantity)).toBe(line.quantity)
    expect(Number(created.price_per_unit)).toBeCloseTo(line.pricePerUnit, 2)
    return created
  })
}

export async function listOrderLines(
  { api }: Ctx,
  orderId: string,
): Promise<SalesOrderLine[]> {
  return test.step(`list line items of order ${orderId.slice(0, 8)}…`, async () => {
    return api.salesorders.listLines(orderId)
  })
}

// ------------------------------------------------------------------
// Compound steps
// ------------------------------------------------------------------

export async function materializeOrder(
  ctx: Ctx,
  opts: {
    customer: Account
    opportunity?: Opportunity
    lines: readonly LineSpec[]
  },
): Promise<SalesOrder> {
  return test.step(`materialize sales order with ${opts.lines.length} line(s)`, async () => {
    const order = await createOrderHeader(ctx, opts)
    for (const line of opts.lines) {
      await addLineItem(ctx, order, line)
    }
    return order
  })
}

export async function verifyOrderMatchesLines(
  ctx: Ctx,
  order: SalesOrder,
  expectedLines: readonly LineSpec[],
): Promise<void> {
  return test.step(`verify order ${order.order_number ?? order.id.slice(0, 8)} reflects its line items`, async () => {
    const actual = await listOrderLines(ctx, order.id)
    expect(actual, 'line count must match spec').toHaveLength(expectedLines.length)

    const expectedTotal = sumExpected(expectedLines)
    const actualSum = actual.reduce((s, l) => s + Number(l.extended_amount ?? 0), 0)
    expect(actualSum, 'sum of extended_amount must match qty × price').toBeCloseTo(expectedTotal, 2)

    const refetched = await ctx.api.salesorders.getById(order.id)
    if (refetched.total_amount !== null) {
      expect(
        Number(refetched.total_amount),
        'order total_amount must match computed line total',
      ).toBeCloseTo(expectedTotal, 2)
    }
  })
}

export async function pickActiveProduct(ctx: Ctx, substring?: string): Promise<Product> {
  return test.step(`pick an active product${substring ? ` matching "${substring}"` : ''}`, async () => {
    const products = await ctx.api.products.list({ active_only: true, search: substring })
    const chosen = products[0]
    expect(chosen, 'at least one active product must be available (run backend seed first?)').toBeDefined()
    expect(chosen.unit_id, 'product must have a default unit of measure').toBeTruthy()
    return chosen
  })
}
