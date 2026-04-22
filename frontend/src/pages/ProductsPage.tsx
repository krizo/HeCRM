import { useState } from 'react'
import { Badge, Card, Empty, ErrorBox, Loading } from '../components/ui'
import { formatMoney } from '../lib/format'
import { useProducts } from '../hooks/queries'
import { PRODUCT_STATE_LABEL } from '../lib/types'

export function ProductsPage() {
  const [showAll, setShowAll] = useState(false)
  const { data, isLoading, error } = useProducts({ active_only: !showAll })

  return (
    <div className="space-y-6" data-testid="products-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Products</h1>
          <p className="text-slate-500 text-sm mt-1">
            Beer / beverage SKUs available for sales orders.
          </p>
        </div>
        <label className="text-sm flex items-center gap-2 text-slate-600">
          <input
            type="checkbox"
            checked={showAll}
            onChange={(e) => setShowAll(e.target.checked)}
            data-testid="products-show-all"
          />
          Show retired / draft
        </label>
      </div>

      <Card>
        {isLoading ? (
          <Loading />
        ) : error ? (
          <div className="p-5">
            <ErrorBox error={error} />
          </div>
        ) : !data || data.length === 0 ? (
          <Empty>No products found.</Empty>
        ) : (
          <table className="w-full text-sm" data-testid="products-table">
            <thead className="bg-slate-50 text-slate-600 text-xs uppercase tracking-wider">
              <tr>
                <th className="text-left px-5 py-3 font-medium">SKU</th>
                <th className="text-left px-5 py-3 font-medium">Name</th>
                <th className="text-right px-5 py-3 font-medium">Price</th>
                <th className="text-right px-5 py-3 font-medium">Cost</th>
                <th className="text-left px-5 py-3 font-medium">State</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {data.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-5 py-3 font-mono text-xs text-slate-700">{p.product_number}</td>
                  <td className="px-5 py-3 font-medium">{p.name}</td>
                  <td className="px-5 py-3 text-right">{formatMoney(p.price)}</td>
                  <td className="px-5 py-3 text-right text-slate-500">{formatMoney(p.cost)}</td>
                  <td className="px-5 py-3">
                    <Badge tone={p.state === 0 ? 'emerald' : 'slate'}>
                      {PRODUCT_STATE_LABEL[p.state] ?? `state=${p.state}`}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  )
}
