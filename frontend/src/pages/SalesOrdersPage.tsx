import { Link } from 'react-router-dom'
import { Badge, Card, Empty, ErrorBox, Loading, formatDate, formatMoney } from '../components/ui'
import { useSalesOrders } from '../hooks/queries'
import { SALES_ORDER_STATE_LABEL } from '../lib/types'

export function SalesOrdersPage() {
  const { data, isLoading, error } = useSalesOrders()

  return (
    <div className="space-y-6" data-testid="salesorders-page">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Sales orders</h1>
        <p className="text-slate-500 text-sm mt-1">
          Confirmed orders, often materialized from won opportunities.
        </p>
      </div>

      <Card>
        {isLoading ? (
          <Loading />
        ) : error ? (
          <div className="p-5">
            <ErrorBox error={error} />
          </div>
        ) : !data || data.length === 0 ? (
          <Empty>No orders found.</Empty>
        ) : (
          <table className="w-full text-sm" data-testid="salesorders-table">
            <thead className="bg-slate-50 text-slate-600 text-xs uppercase tracking-wider">
              <tr>
                <th className="text-left px-5 py-3 font-medium">Order</th>
                <th className="text-left px-5 py-3 font-medium">Number</th>
                <th className="text-right px-5 py-3 font-medium">Total</th>
                <th className="text-left px-5 py-3 font-medium">State</th>
                <th className="text-left px-5 py-3 font-medium">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {data.map((o) => (
                <tr key={o.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-5 py-3">
                    <Link to={`/salesorders/${o.id}`} className="font-medium hover:text-emerald-700">
                      {o.name}
                    </Link>
                  </td>
                  <td className="px-5 py-3 font-mono text-xs text-slate-600">
                    {o.order_number ?? '—'}
                  </td>
                  <td className="px-5 py-3 text-right font-medium">{formatMoney(o.total_amount)}</td>
                  <td className="px-5 py-3">
                    <Badge tone={o.state === 0 ? 'sky' : 'slate'}>
                      {SALES_ORDER_STATE_LABEL[o.state] ?? `state=${o.state}`}
                    </Badge>
                  </td>
                  <td className="px-5 py-3 text-slate-600">{formatDate(o.created_on)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  )
}
