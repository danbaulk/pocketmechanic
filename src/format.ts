import type { PartHealth } from './health.ts'

export function formatMiles(n: number): string {
  return `${Math.round(n).toLocaleString('en-GB')} mi`
}

export function formatCost(low: number, high: number): string {
  return `£${low}–${high}`
}

/** Today as an ISO yyyy-mm-dd string, in local time (for <input type="date"> defaults). */
export function todayISO(): string {
  const d = new Date()
  const offset = d.getTimezoneOffset() * 60_000
  return new Date(d.getTime() - offset).toISOString().slice(0, 10)
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function formatDuration(days: number): string {
  if (days >= 365) {
    const years = days / 365.25
    return `${years.toFixed(years < 10 ? 1 : 0)} yr`
  }
  if (days >= 60) return `${Math.round(days / 30.44)} months`
  if (days >= 14) return `${Math.round(days / 7)} weeks`
  return `${Math.max(0, Math.round(days))} days`
}

/** Human "due" text from the driving clock, e.g. "due in 2,400 mi" or "overdue by 3 months". */
export function dueText(health: PartHealth): string {
  if (!health.known) return 'Fitment not recorded'

  if (health.driver === 'mileage' && health.milesRemaining !== undefined) {
    const r = health.milesRemaining
    return r >= 0 ? `due in ${formatMiles(r)}` : `overdue by ${formatMiles(-r)}`
  }
  if (health.driver === 'age' && health.daysRemaining !== undefined) {
    const d = health.daysRemaining
    return d >= 0 ? `due in ${formatDuration(d)}` : `overdue by ${formatDuration(-d)}`
  }
  return health.fraction >= 1 ? 'due now' : 'healthy'
}

export function consumedPercent(health: PartHealth): number {
  return Math.max(0, Math.round(health.fraction * 100))
}
