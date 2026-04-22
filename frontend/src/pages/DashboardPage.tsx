import { Link } from 'react-router-dom'
import { Badge, Card, CardHeader, Empty, ErrorBox, Loading } from '../components/ui'
import { formatMoney } from '../lib/format'
import {
  useAccounts,
  useOpportunities,
  useProducts,
  useSalesOrders,
} from '../hooks/queries'

export function DashboardPage() {
  const distributors = useAccounts({ customer_type: 'distributor' })
  const retail = useAccounts({ customer_type: 'retail' })
  const open = useOpportunities({ open_only: true })
  const won = useOpportunities({ stage: 'won' })
  const orders = useSalesOrders()
  const products = useProducts({ active_only: true })

  const pipelineValue = (open.data ?? [])
    .filter((o) => o.name.includes('HeCRM') || true)
    .reduce((sum, o) => sum + (o.estimated_value ?? 0), 0)

  const tiles: { label: string; value: string | number; tone?: 'emerald' | 'sky' | 'amber' }[] = [
    { label: 'Distributors', value: distributors.data?.length ?? '—', tone: 'sky' },
    { label: 'Retail accounts', value: retail.data?.length ?? '—', tone: 'sky' },
    { label: 'Open opportunities', value: open.data?.length ?? '—', tone: 'amber' },
    { label: 'Won deals', value: won.data?.length ?? '—', tone: 'emerald' },
    { label: 'Active SKUs', value: products.data?.length ?? '—' },
    { label: 'Sales orders', value: orders.data?.length ?? '—', tone: 'emerald' },
  ]

  return (
    <div className="space-y-8" data-testid="dashboard">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-slate-500 text-sm mt-1">
          A snapshot of the HeCRM sales process pulled live from Dynamics 365 Dataverse.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {tiles.map((t) => (
          <Card key={t.label} className="p-4">
            <div className="text-xs uppercase tracking-wider text-slate-500">{t.label}</div>
            <div
              className={`mt-2 text-2xl font-semibold ${
                t.tone === 'emerald'
                  ? 'text-emerald-700'
                  : t.tone === 'amber'
                    ? 'text-amber-700'
                    : t.tone === 'sky'
                      ? 'text-sky-700'
                      : 'text-slate-900'
              }`}
            >
              {t.value}
            </div>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader
          title="Open pipeline value"
          subtitle="Sum of estimated value across all open opportunities."
        />
        <div className="px-5 py-6 text-3xl font-semibold">{formatMoney(pipelineValue)}</div>
      </Card>

      <Card>
        <CardHeader
          title="Recent sales orders"
          subtitle="Latest orders logged against distributor or retail accounts."
        />
        <div className="divide-y divide-slate-200">
          {orders.isLoading ? (
            <Loading />
          ) : orders.error ? (
            <div className="p-5">
              <ErrorBox error={orders.error} />
            </div>
          ) : orders.data && orders.data.length > 0 ? (
            orders.data.slice(0, 5).map((o) => (
              <Link
                key={o.id}
                to={`/salesorders/${o.id}`}
                className="flex items-center justify-between px-5 py-3 hover:bg-slate-50 transition-colors"
              >
                <div className="min-w-0">
                  <div className="font-medium truncate">{o.name}</div>
                  <div className="text-xs text-slate-500">{o.order_number ?? '—'}</div>
                </div>
                <div className="flex items-center gap-4">
                  <Badge tone="emerald">{formatMoney(o.total_amount)}</Badge>
                </div>
              </Link>
            ))
          ) : (
            <Empty>No sales orders yet.</Empty>
          )}
        </div>
      </Card>
    </div>
  )
}
