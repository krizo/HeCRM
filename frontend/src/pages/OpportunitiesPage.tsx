import { Link } from 'react-router-dom'
import { Badge, Card, CardHeader, Empty, ErrorBox, Loading } from '../components/ui'
import { formatMoney } from '../lib/format'
import {
  useAdvanceOpportunityStage,
  useLoseOpportunity,
  useOpportunities,
  useWinOpportunity,
} from '../hooks/queries'
import { ALL_STAGES, OPEN_STAGES, nextOpenStage, stageBadgeTone, stageLabel } from '../lib/stages'
import type { Opportunity, OpportunityStage } from '../lib/types'

export function OpportunitiesPage() {
  const { data, isLoading, error } = useOpportunities()
  const advance = useAdvanceOpportunityStage()
  const win = useWinOpportunity()
  const lose = useLoseOpportunity()

  if (isLoading) return <Loading />
  if (error) return <ErrorBox error={error} />

  const byStage = new Map<OpportunityStage, Opportunity[]>()
  for (const stage of ALL_STAGES) byStage.set(stage, [])
  for (const o of data ?? []) byStage.get(o.stage)?.push(o)

  return (
    <div className="space-y-6" data-testid="opportunities-page">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Opportunities pipeline</h1>
        <p className="text-slate-500 text-sm mt-1">
          Stages map to Dataverse <code className="px-1 bg-slate-100 rounded text-xs">salesstage</code>;
          terminal Won/Lost invoke the native WinOpportunity / LoseOpportunity actions.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4" data-testid="pipeline-open">
        {OPEN_STAGES.map((stage) => {
          const items = byStage.get(stage) ?? []
          const totalValue = items.reduce((sum, o) => sum + (o.estimated_value ?? 0), 0)
          return (
            <Card key={stage} className="flex flex-col" data-testid={`kanban-col-${stage}`}>
              <CardHeader
                title={
                  <span className="flex items-center gap-2">
                    <Badge tone={stageBadgeTone(stage)}>{stageLabel(stage)}</Badge>
                    <span className="text-xs text-slate-400">{items.length}</span>
                  </span>
                }
                subtitle={formatMoney(totalValue)}
              />
              <div className="flex-1 p-3 space-y-2 min-h-32">
                {items.length === 0 ? (
                  <div className="text-xs text-slate-400 text-center py-4">empty</div>
                ) : (
                  items.map((o) => {
                    const next = nextOpenStage(o.stage)
                    return (
                      <div
                        key={o.id}
                        className="p-3 rounded-md border border-slate-200 bg-white hover:border-emerald-400 transition-colors"
                        data-testid={`opp-card-${o.id}`}
                      >
                        <div className="font-medium text-sm mb-1">{o.name}</div>
                        <div className="text-xs text-slate-500 mb-2">
                          {formatMoney(o.estimated_value)}
                        </div>
                        <div className="flex items-center gap-1 flex-wrap">
                          {next ? (
                            <button
                              onClick={() => advance.mutate({ id: o.id, stage: next })}
                              className="text-xs px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 transition-colors"
                              data-testid={`opp-advance-${o.id}`}
                            >
                              → {stageLabel(next)}
                            </button>
                          ) : null}
                          <button
                            onClick={() => win.mutate(o.id)}
                            className="text-xs px-2 py-1 rounded bg-emerald-100 text-emerald-800 hover:bg-emerald-200 transition-colors"
                            data-testid={`opp-win-${o.id}`}
                          >
                            Win
                          </button>
                          <button
                            onClick={() => lose.mutate(o.id)}
                            className="text-xs px-2 py-1 rounded bg-rose-100 text-rose-800 hover:bg-rose-200 transition-colors"
                            data-testid={`opp-lose-${o.id}`}
                          >
                            Lose
                          </button>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </Card>
          )
        })}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {(['won', 'lost'] as OpportunityStage[]).map((stage) => {
          const items = byStage.get(stage) ?? []
          return (
            <Card key={stage} data-testid={`kanban-panel-${stage}`}>
              <CardHeader
                title={
                  <span className="flex items-center gap-2">
                    <Badge tone={stageBadgeTone(stage)}>{stageLabel(stage)}</Badge>
                    <span className="text-xs text-slate-400">{items.length}</span>
                  </span>
                }
              />
              {items.length === 0 ? (
                <Empty>No {stage} deals.</Empty>
              ) : (
                <ul className="divide-y divide-slate-200">
                  {items.slice(0, 10).map((o) => (
                    <li key={o.id} data-testid={`kanban-panel-${stage}-item-${o.id}`} className="px-5 py-3 flex items-center justify-between">
                      <div className="min-w-0">
                        <Link
                          to={o.customer_id ? `/accounts/${o.customer_id}` : '#'}
                          className="text-sm font-medium truncate hover:text-emerald-700"
                        >
                          {o.name}
                        </Link>
                      </div>
                      <span className="text-xs text-slate-500 ml-4 shrink-0">
                        {formatMoney(o.estimated_value)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          )
        })}
      </div>
    </div>
  )
}
