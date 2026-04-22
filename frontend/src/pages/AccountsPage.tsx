import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Badge, Card, Empty, ErrorBox, Loading } from '../components/ui'
import { useAccounts } from '../hooks/queries'
import type { CustomerType } from '../lib/types'

type Filter = 'all' | CustomerType

export function AccountsPage() {
  const [filter, setFilter] = useState<Filter>('all')
  const [search, setSearch] = useState('')

  const { data, isLoading, error } = useAccounts({
    customer_type: filter === 'all' ? undefined : filter,
    search: search || undefined,
  })

  return (
    <div className="space-y-6" data-testid="accounts-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Accounts</h1>
          <p className="text-slate-500 text-sm mt-1">
            Distributors, retail customers, and their parent relationships.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="search"
            placeholder="Search by name…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="px-3 py-1.5 rounded-md border border-slate-300 text-sm w-64 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            data-testid="accounts-search"
          />
        </div>
      </div>

      <div className="flex items-center gap-1 border-b border-slate-200">
        {(['all', 'distributor', 'retail'] as Filter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 text-sm -mb-px border-b-2 transition-colors ${
              filter === f
                ? 'border-emerald-600 text-emerald-700 font-medium'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
            data-testid={`accounts-filter-${f}`}
          >
            {f === 'all' ? 'All' : f === 'distributor' ? 'Distributors' : 'Retail'}
          </button>
        ))}
      </div>

      <Card>
        {isLoading ? (
          <Loading />
        ) : error ? (
          <div className="p-5">
            <ErrorBox error={error} />
          </div>
        ) : !data || data.length === 0 ? (
          <Empty>No accounts match your filter.</Empty>
        ) : (
          <table className="w-full text-sm" data-testid="accounts-table">
            <thead className="bg-slate-50 text-slate-600 text-xs uppercase tracking-wider">
              <tr>
                <th className="text-left px-5 py-3 font-medium">Name</th>
                <th className="text-left px-5 py-3 font-medium">Type</th>
                <th className="text-left px-5 py-3 font-medium">City</th>
                <th className="text-left px-5 py-3 font-medium">Phone</th>
                <th className="text-left px-5 py-3 font-medium">Number</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {data.map((a) => (
                <tr key={a.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-5 py-3">
                    <Link to={`/accounts/${a.id}`} className="font-medium text-slate-900 hover:text-emerald-700">
                      {a.name}
                    </Link>
                  </td>
                  <td className="px-5 py-3">
                    <Badge tone={a.customer_type === 'distributor' ? 'violet' : 'sky'}>
                      {a.customer_type}
                    </Badge>
                  </td>
                  <td className="px-5 py-3 text-slate-700">{a.city ?? '—'}</td>
                  <td className="px-5 py-3 text-slate-700">{a.phone ?? '—'}</td>
                  <td className="px-5 py-3 text-slate-500 font-mono text-xs">
                    {a.account_number ?? '—'}
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
