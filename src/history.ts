import type { HistoryEntry, HistoryKind, PartRef, Vehicle } from './types.ts'
import { getCataloguePart } from './data/partsCatalogue.ts'

/**
 * The item with the latest date, ties resolving to the later-added one. Every value derived
 * from history follows this one ordering rule - timeline order, a part's wear clock
 * (`effectiveFitment`) and the odometer anchor (`deriveAnchor`) - so it lives here once
 * rather than being restated at each site. ISO yyyy-mm-dd dates compare correctly as strings.
 * Null for an empty list.
 */
export function latestByDate<T>(items: T[], getDate: (item: T) => string): T | null {
  let best: T | null = null
  for (const item of items) {
    if (best === null || getDate(item) >= getDate(best)) best = item
  }
  return best
}

/** A history entry known to carry a mileage. */
type DatedMileage = HistoryEntry & { mileage: number }

/**
 * The odometer anchor implied by history: the latest dated entry carrying a mileage. Null when
 * no entry carries one, leaving the caller's existing anchor to stand. Deriving this (rather
 * than accumulating it) is what lets editing or deleting an entry re-anchor the estimate
 * instead of stranding it on a reading that no longer exists.
 */
export function deriveAnchor(history: HistoryEntry[]): { miles: number; date: string } | null {
  const withMileage = history.filter((h): h is DatedMileage => h.mileage !== null)
  const latest = latestByDate(withMileage, (h) => h.date)
  return latest === null ? null : { miles: latest.mileage, date: latest.date }
}

/**
 * A vehicle's history entries ordered newest-first (by date). Entries sharing a date fall
 * back to most-recently-added first (the `latestByDate` rule, applied as a full sort), so a
 * correction logged today sits above an older same-day entry. Framework-free and tested.
 */
export function getHistory(vehicle: Vehicle): HistoryEntry[] {
  return vehicle.history
    .map((entry, index) => ({ entry, index }))
    .sort((a, b) => {
      if (a.entry.date !== b.entry.date) return a.entry.date < b.entry.date ? 1 : -1
      return b.index - a.index
    })
    .map((x) => x.entry)
}

/**
 * The lowest mileage a reading/entry dated `date` may carry, keeping the odometer monotonic:
 * it can never sit below a mileage already logged on an equal-or-earlier date. `exceptId` skips
 * the entry being edited so it doesn't constrain itself. Mileage-less entries are ignored.
 */
export function minLoggableMileage(history: HistoryEntry[], date: string, exceptId?: string): number {
  let min = 0
  for (const h of history) {
    if (h.id === exceptId || h.mileage === null) continue
    if (h.date <= date) min = Math.max(min, h.mileage)
  }
  return min
}

/** Display metadata per history kind; colour/icon classes live in the component layer. */
export const HISTORY_KIND_META: Record<HistoryKind, { label: string; description: string }> = {
  service: { label: 'Service', description: 'Routine service or maintenance' },
  mot: { label: 'MOT', description: 'Annual MOT test' },
  repair: { label: 'Repair', description: 'A fault fixed or work carried out' },
  inspection: { label: 'Inspection', description: 'Parts checked and found not to need replacing' },
  replacement: { label: 'Part replaced', description: 'A tracked part was replaced' },
  reading: { label: 'Odometer reading', description: 'A recorded mileage reading' },
}

/** Catalogue names for a set of part refs, falling back to a bare "part" for a stale slug. */
function refNames(refs: PartRef[]): string {
  return refs.map((r) => getCataloguePart(r.catalogueId)?.name ?? 'part').join(', ')
}

/**
 * Human detail line for an entry, beyond its kind badge, date and mileage: the parts it
 * replaced and/or checked, an MOT result, and/or the free-text note. Null when there's
 * nothing to add.
 */
export function entryDetail(entry: HistoryEntry): string | null {
  const parts: string[] = []
  if (entry.partRefs?.length) {
    parts.push(`Replaced: ${refNames(entry.partRefs)}`)
  }
  if (entry.checkedRefs?.length) {
    parts.push(`Checked: ${refNames(entry.checkedRefs)}`)
  }
  if (entry.kind === 'mot' && entry.motResult) {
    parts.push(entry.motResult === 'pass' ? 'Passed' : 'Failed')
  }
  if (entry.note) parts.push(entry.note)
  return parts.length ? parts.join(' · ') : null
}
