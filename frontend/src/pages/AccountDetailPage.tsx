import { Link, useParams } from 'react-router-dom'
import { Badge, Card, CardHeader, Empty, ErrorBox, Loading } from '../components/ui'
import { formatMoney } from '../lib/format'
import { stageBadgeTone, stageLabel } from '../lib/stages'
import {
  useAccount,
  useAccounts,
  useContacts,
  useOpportunities,
  useSalesOrders,
} from '../hooks/queries'

export function AccountDetailPage() {
  const { id } = useParams<{ id: string }>()
  const account = useAccount(id)
  const contacts = useContacts({ account_id: id })
  const opportunities = useOpportunities({ customer_id: id })
  const orders = useSalesOrders({ customer_id: id })
  const children = useAccounts({ customer_type: 'retail' })

  if (account.isLoading) return <Loading />
  if (account.error) return <ErrorBox error={account.error} />
  if (!account.data) return <Empty>Account not found.</Empty>

  const a = account.data
  const childRetail = (children.data ?? []).filter((c) => c.parent_account_id === a.id)

  return (
    <div className="space-y-6" data-testid="account-detail">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-sm text-slate-500 mb-1">
            <Link to="/accounts" className="hover:underline">Accounts</Link> &nbsp;/&nbsp; {a.customer_type}
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">{a.name}</h1>
          <div className="mt-2 flex items-center gap-2">
            <Badge tone={a.customer_type === 'distributor' ? 'violet' : 'sky'}>
              {a.customer_type}
            </Badge>
            {a.account_number ? (
              <span className="text-xs text-slate-500 font-mono">{a.account_number}</span>
            ) : null}
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader title="Details" />
          <dl className="px-5 py-4 grid grid-cols-3 gap-y-3 text-sm">
            <dt className="text-slate-500">City</dt>
            <dd className="col-span-2 text-slate-800">{a.city ?? '—'}</dd>
            <dt className="text-slate-500">Country</dt>
            <dd className="col-span-2 text-slate-800">{a.country ?? '—'}</dd>
            <dt className="text-slate-500">Phone</dt>
            <dd className="col-span-2 text-slate-800">{a.phone ?? '—'}</dd>
            <dt className="text-slate-500">Email</dt>
            <dd className="col-span-2 text-slate-800">{a.email ?? '—'}</dd>
            <dt className="text-slate-500">Website</dt>
            <dd className="col-span-2 text-slate-800">
              {a.website ? (
                <a href={a.website} target="_blank" rel="noreferrer" className="text-emerald-700 hover:underline">
                  {a.website}
                </a>
              ) : (
                '—'
              )}
            </dd>
          </dl>
        </Card>

        <Card>
          <CardHeader title="Contacts" subtitle={`${contacts.data?.length ?? 0} people`} />
          {contacts.isLoading ? (
            <Loading />
          ) : !contacts.data || contacts.data.length === 0 ? (
            <Empty>No contacts yet.</Empty>
          ) : (
            <ul className="divide-y divide-slate-200">
              {contacts.data.map((c) => (
                <li key={c.id} className="px-5 py-3 flex items-center justify-between">
                  <div>
                    <div className="font-medium">{c.full_name ?? `${c.first_name} ${c.last_name}`}</div>
                    <div className="text-xs text-slate-500">{c.job_title ?? '—'}</div>
                  </div>
                  <div className="text-xs text-slate-600 text-right">
                    <div>{c.email ?? '—'}</div>
                    <div>{c.phone ?? '—'}</div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {a.customer_type === 'distributor' ? (
        <Card>
          <CardHeader
            title="Retail accounts under this distributor"
            subtitle={`${childRetail.length} children`}
          />
          {childRetail.length === 0 ? (
            <Empty>No retail accounts linked.</Empty>
          ) : (
            <ul className="divide-y divide-slate-200">
              {childRetail.map((r) => (
                <li key={r.id} className="px-5 py-3">
                  <Link to={`/accounts/${r.id}`} className="font-medium hover:text-emerald-700">
                    {r.name}
                  </Link>
                  <span className="ml-3 text-xs text-slate-500">{r.city ?? '—'}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      ) : null}

      <Card>
        <CardHeader title="Opportunities" subtitle={`${opportunities.data?.length ?? 0} total`} />
        {opportunities.isLoading ? (
          <Loading />
        ) : !opportunities.data || opportunities.data.length === 0 ? (
          <Empty>No opportunities yet.</Empty>
        ) : (
          <ul className="divide-y divide-slate-200">
            {opportunities.data.map((o) => (
              <li key={o.id} className="px-5 py-3 flex items-center justify-between">
                <div>
                  <div className="font-medium">{o.name}</div>
                  <div className="text-xs text-slate-500">{formatMoney(o.estimated_value)}</div>
                </div>
                <Badge tone={stageBadgeTone(o.stage)}>{stageLabel(o.stage)}</Badge>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <CardHeader title="Sales orders" subtitle={`${orders.data?.length ?? 0} total`} />
        {orders.isLoading ? (
          <Loading />
        ) : !orders.data || orders.data.length === 0 ? (
          <Empty>No orders yet.</Empty>
        ) : (
          <ul className="divide-y divide-slate-200">
            {orders.data.map((o) => (
              <li key={o.id} className="px-5 py-3 flex items-center justify-between">
                <div>
                  <Link to={`/salesorders/${o.id}`} className="font-medium hover:text-emerald-700">
                    {o.name}
                  </Link>
                  <div className="text-xs text-slate-500">{o.order_number ?? '—'}</div>
                </div>
                <Badge tone="emerald">{formatMoney(o.total_amount)}</Badge>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}
