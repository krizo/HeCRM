import { Link, useParams } from 'react-router-dom'
import {
  Badge,
  Card,
  CardHeader,
  Empty,
  ErrorBox,
  Loading,
  formatDate,
  formatMoney,
} from '../components/ui'
import { useAccount, useSalesOrder, useSalesOrderLines } from '../hooks/queries'
import { SALES_ORDER_STATE_LABEL } from '../lib/types'

export function SalesOrderDetailPage() {
  const { id } = useParams<{ id: string }>()
  const order = useSalesOrder(id)
  const lines = useSalesOrderLines(id)
  const customer = useAccount(order.data?.customer_id ?? undefined)

  if (order.isLoading) return <Loading />
  if (order.error) return <ErrorBox error={order.error} />
  if (!order.data) return <Empty>Order not found.</Empty>

  const o = order.data
  const linesTotal = (lines.data ?? []).reduce((sum, l) => sum + (l.extended_amount ?? 0), 0)

  return (
    <div className="space-y-6" data-testid="salesorder-detail">
      <div>
        <div className="text-sm text-slate-500 mb-1">
          <Link to="/salesorders" className="hover:underline">Sales orders</Link>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">{o.name}</h1>
        <div className="mt-2 flex items-center gap-3 text-sm text-slate-600">
          <span className="font-mono">{o.order_number ?? '—'}</span>
          <Badge tone={o.state === 0 ? 'sky' : 'slate'}>
            {SALES_ORDER_STATE_LABEL[o.state] ?? `state=${o.state}`}
          </Badge>
          <span>Created {formatDate(o.created_on)}</span>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader title="Details" />
          <dl className="px-5 py-4 grid grid-cols-3 gap-y-3 text-sm">
            <dt className="text-slate-500">Customer</dt>
            <dd className="col-span-2">
              {customer.data ? (
                <Link to={`/accounts/${customer.data.id}`} className="text-emerald-700 hover:underline">
                  {customer.data.name}
                </Link>
              ) : (
                '—'
              )}
            </dd>
            <dt className="text-slate-500">Opportunity</dt>
            <dd className="col-span-2 font-mono text-xs">{o.opportunity_id ?? '—'}</dd>
            <dt className="text-slate-500">Description</dt>
            <dd className="col-span-2">{o.description ?? '—'}</dd>
          </dl>
        </Card>

        <Card>
          <CardHeader title="Total" />
          <div className="px-5 py-6">
            <div className="text-3xl font-semibold text-emerald-700">{formatMoney(o.total_amount)}</div>
            <div className="text-xs text-slate-500 mt-1">
              Sum of line items: {formatMoney(linesTotal)}
            </div>
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader title="Line items" subtitle={`${lines.data?.length ?? 0} items`} />
        {lines.isLoading ? (
          <Loading />
        ) : !lines.data || lines.data.length === 0 ? (
          <Empty>No line items.</Empty>
        ) : (
          <table className="w-full text-sm" data-testid="salesorder-lines-table">
            <thead className="bg-slate-50 text-slate-600 text-xs uppercase tracking-wider">
              <tr>
                <th className="text-left px-5 py-3 font-medium">Product</th>
                <th className="text-right px-5 py-3 font-medium">Qty</th>
                <th className="text-right px-5 py-3 font-medium">Unit price</th>
                <th className="text-right px-5 py-3 font-medium">Extended</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {lines.data.map((l) => (
                <tr key={l.id}>
                  <td className="px-5 py-3 font-medium">{l.product_name ?? '—'}</td>
                  <td className="px-5 py-3 text-right">{l.quantity}</td>
                  <td className="px-5 py-3 text-right">{formatMoney(l.price_per_unit)}</td>
                  <td className="px-5 py-3 text-right font-medium">{formatMoney(l.extended_amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  )
}
