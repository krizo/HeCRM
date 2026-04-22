export function formatMoney(value: number | null | undefined, currency = 'PLN'): string {
  if (value === null || value === undefined) return '—'
  try {
    return new Intl.NumberFormat('pl-PL', {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(value)
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
