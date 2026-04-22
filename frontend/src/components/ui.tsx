import type { ReactNode } from 'react'

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`bg-white rounded-lg border border-slate-200 shadow-sm ${className}`}
      data-testid="card"
    >
      {children}
    </div>
  )
}

export function CardHeader({
  title,
  subtitle,
  actions,
}: {
  title: ReactNode
  subtitle?: ReactNode
  actions?: ReactNode
}) {
  return (
    <div className="px-5 py-4 border-b border-slate-200 flex items-center gap-4">
      <div className="flex-1">
        <h2 className="font-semibold text-slate-900">{title}</h2>
        {subtitle ? <div className="text-sm text-slate-500 mt-0.5">{subtitle}</div> : null}
      </div>
      {actions}
    </div>
  )
}

export function Badge({
  children,
  tone = 'slate',
}: {
  children: ReactNode
  tone?: 'slate' | 'emerald' | 'amber' | 'rose' | 'sky' | 'violet'
}) {
  const tones: Record<string, string> = {
    slate: 'bg-slate-100 text-slate-700 ring-slate-200',
    emerald: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    amber: 'bg-amber-50 text-amber-700 ring-amber-200',
    rose: 'bg-rose-50 text-rose-700 ring-rose-200',
    sky: 'bg-sky-50 text-sky-700 ring-sky-200',
    violet: 'bg-violet-50 text-violet-700 ring-violet-200',
  }
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ring-1 ring-inset ${tones[tone]}`}
    >
      {children}
    </span>
  )
}

export function Loading({ label = 'Loading…' }: { label?: string }) {
  return <div className="text-slate-500 text-sm py-8 text-center">{label}</div>
}

export function ErrorBox({ error }: { error: unknown }) {
  const msg = error instanceof Error ? error.message : String(error)
  return (
    <div
      className="bg-rose-50 border border-rose-200 text-rose-800 rounded-md px-4 py-3 text-sm"
      role="alert"
    >
      {msg}
    </div>
  )
}

export function Empty({ children }: { children: ReactNode }) {
  return (
    <div className="text-slate-400 text-sm py-8 text-center" data-testid="empty-state">
      {children}
    </div>
  )
}

export function formatMoney(value: number | null | undefined, currency = 'PLN'): string {
  if (value === null || value === undefined) return '—'
  try {
    return new Intl.NumberFormat('pl-PL', { style: 'currency', currency, maximumFractionDigits: 2 }).format(value)
  } catch {
    return `${value.toFixed(2)} ${currency}`
  }
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleDateString('pl-PL', { year: 'numeric', month: 'short', day: 'numeric' })
}
