import { describe, it, expect } from 'vitest'
import { computePartHealth, type PartHealth } from './health.ts'
import type { FittedPart } from './types.ts'
import type { CataloguePart } from './data/partsCatalogue.ts'
import { consumedPercent, dueText, wearPercent } from './format.ts'

const pads: CataloguePart = {
  id: 'brake-pads-front', name: 'Front brake pads', zone: 'Front wheels',
  mileageInterval: 30_000, costLow: 40, costHigh: 120,
}
const battery: CataloguePart = {
  id: 'battery', name: '12V battery', zone: 'Engine bay',
  ageYears: 5, costLow: 80, costHigh: 200,
}
// A catalogue part with neither interval - no clock to report a "remaining" figure for.
const untracked: CataloguePart = {
  id: 'untracked', name: 'Untracked part', zone: 'Engine bay',
  costLow: 0, costHigh: 0,
}

const NOW = new Date('2026-07-04T12:00:00Z')

function part(over: Partial<FittedPart> = {}): FittedPart {
  return { id: 'p1', catalogueId: 'x', fitDate: '2024-07-04', fitMileage: 50_000, ...over }
}

/** An inspected, still-in-life part: checked at 90k (40k used) → 47.5k extended life, 41k used. */
function inspectedPads(): PartHealth {
  return computePartHealth(part({ fitMileage: 50_000 }), pads, 91_000, NOW, { date: '2026-06-04', mileage: 90_000 })
}

describe('dueText', () => {
  it('reads "Fitment not recorded" when fitment is unknown', () => {
    const h = computePartHealth(part({ fitDate: null }), pads, 60_000, NOW)
    expect(dueText(h)).toBe('Fitment not recorded')
  })

  it('gives miles remaining on a mileage-driven part', () => {
    // 10k of 30k used → 20k left.
    const h = computePartHealth(part({ fitMileage: 50_000 }), pads, 60_000, NOW)
    expect(dueText(h)).toBe('due in 20,000 mi')
  })

  it('says how far overdue a mileage-driven part is', () => {
    // 35k of 30k used → 5k over.
    const h = computePartHealth(part({ fitMileage: 50_000 }), pads, 85_000, NOW)
    expect(dueText(h)).toBe('overdue by 5,000 mi')
  })

  it('gives a duration on an age-driven part', () => {
    // Battery fitted 2024, 2.5 years into a 5-year life → 2.5 yr left.
    const h = computePartHealth(part({ fitDate: '2024-01-01', fitMileage: 0 }), battery, 0, NOW)
    expect(dueText(h)).toBe('due in 2.5 yr')
  })

  it('says how far overdue an age-driven part is', () => {
    // Battery fitted 2021, 5.5 years into a 5-year life → ~6 months over.
    const h = computePartHealth(part({ fitDate: '2021-01-01', fitMileage: 0 }), battery, 0, NOW)
    expect(dueText(h)).toBe('overdue by 6 months')
  })

  it('names the check while an inspected part still has extended life', () => {
    // Extended life 47.5k, 41k used → 6.5k left, prefixed to credit the inspection.
    expect(dueText(inspectedPads())).toBe('checked OK - due in 6,500 mi')
  })

  it('drops the "checked OK" prefix once the part is overdue even on its extended life', () => {
    // 48.5k used of the 47.5k extended life: the check vouches for nothing now, so plain wording.
    const h = computePartHealth(part({ fitMileage: 50_000 }), pads, 98_500, NOW, { date: '2026-06-04', mileage: 90_000 })
    expect(h.inspected).toBeDefined()
    expect(dueText(h)).toBe('overdue by 1,000 mi')
  })

  it('falls back to healthy/due-now when neither clock is tracked', () => {
    const h = computePartHealth(part({ fitMileage: 50_000 }), untracked, 60_000, NOW)
    expect(dueText(h)).toBe('healthy')
  })
})

describe('consumedPercent', () => {
  it('reads the active (extended) clock for an inspected part', () => {
    // 41k of the 47.5k extended life = 86%.
    expect(consumedPercent(inspectedPads())).toBe(86)
  })

  it('clamps a not-yet-started part to 0 rather than a negative percentage', () => {
    // currentMileage below fitMileage → negative fraction, floored at 0.
    const h = computePartHealth(part({ fitMileage: 50_000 }), pads, 40_000, NOW)
    expect(consumedPercent(h)).toBe(0)
  })
})

describe('wearPercent', () => {
  it('reports true wear against the nominal interval, ignoring the inspection', () => {
    // 41k of the usual 30k interval = 137%, even though the part shows green on its extended clock.
    const h = inspectedPads()
    expect(h.rag).toBe('green')
    expect(wearPercent(h)).toBe(137)
    expect(consumedPercent(h)).toBe(86)
  })
})
