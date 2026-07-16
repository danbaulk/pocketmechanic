import type { HistoryEntry, HistoryKind, Vehicle } from './types.ts'
import { getCataloguePart } from './data/partsCatalogue.ts'

/**
 * A vehicle's history entries ordered newest-first (by date). Entries sharing a date fall
 * back to most-recently-added first, so a correction logged today sits above an older
 * same-day entry. Framework-free and tested (see history.test.ts).
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

/** Display metadata per history kind; colour/icon classes live in the component layer. */
export const HISTORY_KIND_META: Record<HistoryKind, { label: string; description: string }> = {
  service: { label: 'Service', description: 'Routine service or maintenance' },
  mot: { label: 'MOT', description: 'Annual MOT test' },
  repair: { label: 'Repair', description: 'A fault fixed or work carried out' },
  replacement: { label: 'Part replaced', description: 'A tracked part was replaced' },
  reading: { label: 'Odometer reading', description: 'A recorded mileage reading' },
}

/**
 * Human detail line for an entry, beyond its kind badge, date and mileage: the replaced
 * part's name, an MOT result, and/or the free-text note. Null when there's nothing to add.
 */
export function entryDetail(entry: HistoryEntry): string | null {
  const parts: string[] = []
  if (entry.partRefs?.length) {
    const names = entry.partRefs.map((r) => getCataloguePart(r.catalogueId)?.name ?? 'part')
    parts.push(`Replaced: ${names.join(', ')}`)
  }
  if (entry.kind === 'mot' && entry.motResult) {
    parts.push(entry.motResult === 'pass' ? 'Passed' : 'Failed')
  }
  if (entry.note) parts.push(entry.note)
  return parts.length ? parts.join(' · ') : null
}
