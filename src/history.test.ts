import { describe, it, expect } from 'vitest'
import { deriveAnchor, entryDetail, getHistory, latestByDate, minLoggableMileage } from './history.ts'
import type { HistoryEntry, Vehicle } from './types.ts'

function vehicleWith(history: HistoryEntry[]): Vehicle {
  return {
    id: 'v', make: 'M', model: 'D', year: 2020,
    lastReadingMiles: 0, lastReadingDate: '2020-01-01', avgAnnualMiles: 0,
    parts: [], history,
  }
}

describe('getHistory', () => {
  it('orders entries newest-first by date', () => {
    const v = vehicleWith([
      { id: 'a', kind: 'reading', date: '2024-01-01', mileage: 1 },
      { id: 'b', kind: 'service', date: '2026-06-01', mileage: 2 },
      { id: 'c', kind: 'repair', date: '2025-03-01', mileage: 3 },
    ])
    expect(getHistory(v).map((e) => e.id)).toEqual(['b', 'c', 'a'])
  })

  it('breaks date ties by most-recently-added first', () => {
    const v = vehicleWith([
      { id: 'a', kind: 'service', date: '2026-06-01', mileage: 1 },
      { id: 'b', kind: 'repair', date: '2026-06-01', mileage: 2 },
    ])
    expect(getHistory(v).map((e) => e.id)).toEqual(['b', 'a'])
  })

  it('does not mutate the source array', () => {
    const entries: HistoryEntry[] = [
      { id: 'a', kind: 'service', date: '2024-01-01', mileage: 1 },
      { id: 'b', kind: 'service', date: '2026-01-01', mileage: 2 },
    ]
    getHistory(vehicleWith(entries))
    expect(entries.map((e) => e.id)).toEqual(['a', 'b'])
  })
})

describe('latestByDate', () => {
  const items = [{ d: '2024-01-01', n: 1 }, { d: '2026-01-01', n: 2 }, { d: '2025-01-01', n: 3 }]

  it('picks the latest date regardless of list order', () => {
    expect(latestByDate(items, (i) => i.d)?.n).toBe(2)
  })

  it('resolves same-date ties to the later-added item', () => {
    const tied = [{ d: '2026-01-01', n: 1 }, { d: '2026-01-01', n: 2 }]
    expect(latestByDate(tied, (i) => i.d)?.n).toBe(2)
  })

  it('is null for an empty list', () => {
    expect(latestByDate([], (i: { d: string }) => i.d)).toBeNull()
  })
})

describe('deriveAnchor', () => {
  it('takes the latest entry carrying a mileage, ignoring mileage-less ones', () => {
    const history: HistoryEntry[] = [
      { id: 'a', kind: 'reading', date: '2024-01-01', mileage: 40_000 },
      { id: 'b', kind: 'service', date: '2026-01-01', mileage: 54_200 },
      { id: 'c', kind: 'mot', date: '2026-06-01', mileage: null }, // newer, but no mileage
    ]
    expect(deriveAnchor(history)).toEqual({ miles: 54_200, date: '2026-01-01' })
  })

  it('is null when nothing carries a mileage, leaving the existing anchor to stand', () => {
    expect(deriveAnchor([{ id: 'c', kind: 'mot', date: '2026-06-01', mileage: null }])).toBeNull()
    expect(deriveAnchor([])).toBeNull()
  })
})

describe('minLoggableMileage', () => {
  const history: HistoryEntry[] = [
    { id: 'a', kind: 'reading', date: '2024-01-01', mileage: 40_000 },
    { id: 'b', kind: 'service', date: '2026-01-01', mileage: 54_200 },
    { id: 'c', kind: 'mot', date: '2026-03-01', mileage: null }, // no mileage → ignored
  ]

  it('floors a new reading at the highest mileage logged by that date', () => {
    expect(minLoggableMileage(history, '2026-07-04')).toBe(54_200)
  })

  it('lets a back-dated entry sit below later readings', () => {
    // Only the 2024 reading pre-dates this, so 40k is the floor - not the 2026 service.
    expect(minLoggableMileage(history, '2025-01-01')).toBe(40_000)
  })

  it('floors at an entry sharing the same date', () => {
    expect(minLoggableMileage(history, '2026-01-01')).toBe(54_200)
  })

  it('has no floor before any logged reading', () => {
    expect(minLoggableMileage(history, '2020-01-01')).toBe(0)
  })

  it('excludes the entry being edited so it does not constrain itself', () => {
    // Editing 'b' (the highest) leaves only the 2024 reading as the floor.
    expect(minLoggableMileage(history, '2026-01-01', 'b')).toBe(40_000)
  })
})

describe('entryDetail', () => {
  it('lists the replaced parts by catalogue name, plus MOT result and note', () => {
    const entry: HistoryEntry = {
      id: 'e', kind: 'mot', date: '2026-01-01', mileage: 60_000, motResult: 'pass',
      note: 'advisory: tyres', partRefs: [
        { partId: 'p1', catalogueId: 'brake-pads-front' },
        { partId: 'p2', catalogueId: 'brake-discs-front' },
      ],
    }
    expect(entryDetail(entry)).toBe('Replaced: Front brake pads, Front brake discs · Passed · advisory: tyres')
  })

  it('lists the checked parts', () => {
    const entry: HistoryEntry = {
      id: 'e', kind: 'inspection', date: '2026-01-01', mileage: 60_000,
      checkedRefs: [{ partId: 'p1', catalogueId: 'brake-pads-front' }],
    }
    expect(entryDetail(entry)).toBe('Checked: Front brake pads')
  })

  it('distinguishes what a visit replaced from what it merely checked', () => {
    const entry: HistoryEntry = {
      id: 'e', kind: 'service', date: '2026-01-01', mileage: 60_000,
      partRefs: [{ partId: 'p1', catalogueId: 'engine-oil' }],
      checkedRefs: [{ partId: 'p2', catalogueId: 'brake-pads-front' }],
    }
    expect(entryDetail(entry)).toBe('Replaced: Engine oil & filter · Checked: Front brake pads')
  })

  it('is null for a bare entry', () => {
    expect(entryDetail({ id: 'e', kind: 'service', date: '2026-01-01', mileage: 60_000 })).toBeNull()
  })
})
