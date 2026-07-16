import type { Clock, PartHealth } from './health.ts'

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

/** What's left on a clock, from whichever of mileage/age drives it. Null if neither is tracked. */
function remainingText(clock: Clock): { text: string; overdue: boolean } | null {
  if (clock.driver === 'mileage' && clock.milesRemaining !== undefined) {
    const r = clock.milesRemaining
    return { text: formatMiles(Math.abs(r)), overdue: r < 0 }
  }
  if (clock.driver === 'age' && clock.daysRemaining !== undefined) {
    const d = clock.daysRemaining
    return { text: formatDuration(Math.abs(d)), overdue: d < 0 }
  }
  return null
}

/**
 * Human "due" text from the part's active clock, e.g. "due in 2,400 mi" or "overdue by 3
 * months". A passed inspection is why a part still has life left, so it gets named while that
 * life lasts. Once the part is overdue even on its extended clock the check vouches for
 * nothing, and the plain wording stands.
 */
export function dueText(health: PartHealth): string {
  if (!health.known) return 'Fitment not recorded'

  const clock = health.inspected ? health.inspected.extended : health.wear
  const left = remainingText(clock)
  if (!left) return clock.fraction >= 1 ? 'due now' : 'healthy'
  if (left.overdue) return `overdue by ${left.text}`
  return health.inspected ? `checked OK - due in ${left.text}` : `due in ${left.text}`
}

/** How far through the part's active clock, as a percentage - what the progress bar fills to. */
export function consumedPercent(health: PartHealth): number {
  const clock = health.inspected ? health.inspected.extended : health.wear
  return Math.max(0, Math.round(clock.fraction * 100))
}

/** How much of the part's nominal life it has genuinely used, ignoring any inspection. */
export function wearPercent(health: PartHealth): number {
  return Math.max(0, Math.round(health.wear.fraction * 100))
}
