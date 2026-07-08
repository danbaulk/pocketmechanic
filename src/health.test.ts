import { describe, it, expect } from 'vitest'
import {
  computePartHealth,
  estimateCurrentMileage,
  getPartsByZone,
  getPartsWithHealth,
  vehicleWorstRag,
} from './health.ts'
import type { FittedPart, Vehicle } from './types.ts'
import type { CataloguePart } from './data/partsCatalogue.ts'

const pads: CataloguePart = {
  id: 'brake-pads-front',
  name: 'Front brake pads',
  zone: 'Front wheels',
  mileageInterval: 30_000,
  costLow: 40,
  costHigh: 120,
}
const battery: CataloguePart = {
  id: 'battery',
  name: '12V battery',
  zone: 'Engine bay',
  ageYears: 5,
  costLow: 80,
  costHigh: 200,
}
const belt: CataloguePart = {
  id: 'timing-belt',
  name: 'Timing / cam belt',
  zone: 'Engine bay',
  mileageInterval: 70_000,
  ageYears: 7,
  costLow: 300,
  costHigh: 700,
}

const NOW = new Date('2026-07-04T12:00:00Z')

function part(over: Partial<FittedPart> = {}): FittedPart {
  return { id: 'p1', catalogueId: 'x', fitDate: '2024-07-04', fitMileage: 50_000, ...over }
}

describe('estimateCurrentMileage', () => {
  it('projects forward from the last reading by average annual mileage', () => {
    const v: Vehicle = {
      id: 'v', make: 'Ford', model: 'Focus', year: 2018,
      lastReadingMiles: 50_000, lastReadingDate: '2026-07-04', avgAnnualMiles: 7305,
      parts: [],
    }
    // 365 days later: 7305 * 365 / 365.25 = exactly 7300 miles.
    const oneYear = new Date('2027-07-04T00:00:00Z')
    expect(estimateCurrentMileage(v, oneYear)).toBe(57_300)
  })

  it('never estimates below the last actual reading', () => {
    const v: Vehicle = {
      id: 'v', make: 'A', model: 'B', year: 2020,
      lastReadingMiles: 50_000, lastReadingDate: '2026-07-04', avgAnnualMiles: 8000,
      parts: [],
    }
    const before = new Date('2026-01-01T00:00:00Z')
    expect(estimateCurrentMileage(v, before)).toBe(50_000)
  })
})

describe('computePartHealth — mileage clock', () => {
  it('is green well within life', () => {
    // 10k of 30k used = 33%.
    const h = computePartHealth(part({ fitMileage: 50_000 }), pads, 60_000, NOW)
    expect(h.rag).toBe('green')
    expect(h.driver).toBe('mileage')
    expect(h.milesRemaining).toBe(20_000)
  })

  it('turns amber at 90% consumed', () => {
    // 27k of 30k used = 90%.
    const h = computePartHealth(part({ fitMileage: 50_000 }), pads, 77_000, NOW)
    expect(h.rag).toBe('amber')
  })

  it('turns red at/after the interval', () => {
    // 30k of 30k used = 100%.
    const h = computePartHealth(part({ fitMileage: 50_000 }), pads, 80_000, NOW)
    expect(h.rag).toBe('red')
    expect(h.milesRemaining).toBe(0)
  })
})

describe('computePartHealth — age clock', () => {
  it('classifies by years since fitting', () => {
    // Fitted 5+ years ago on a 5-year part → red.
    const h = computePartHealth(part({ fitDate: '2021-01-01', fitMileage: 0 }), battery, 0, NOW)
    expect(h.driver).toBe('age')
    expect(h.rag).toBe('red')
  })

  it('is green when young', () => {
    const h = computePartHealth(part({ fitDate: '2025-01-01', fitMileage: 0 }), battery, 0, NOW)
    expect(h.rag).toBe('green')
  })
})

describe('computePartHealth — soonest wins when both clocks apply', () => {
  it('picks the age clock when it is further along than mileage', () => {
    // Belt: barely any miles used, but fitted 7+ years ago → age drives, red.
    const h = computePartHealth(part({ fitDate: '2018-01-01', fitMileage: 100_000 }), belt, 110_000, NOW)
    expect(h.driver).toBe('age')
    expect(h.rag).toBe('red')
  })

  it('picks the mileage clock when it is further along than age', () => {
    // Belt: fitted recently by date, but 70k+ miles clocked up → mileage drives, red.
    const h = computePartHealth(part({ fitDate: '2025-01-01', fitMileage: 40_000 }), belt, 111_000, NOW)
    expect(h.driver).toBe('mileage')
    expect(h.rag).toBe('red')
  })
})

describe('computePartHealth — unknown fitment', () => {
  it('returns known:false when the fit date or mileage is missing', () => {
    expect(computePartHealth(part({ fitDate: null }), pads, 60_000, NOW).known).toBe(false)
    expect(computePartHealth(part({ fitMileage: null }), pads, 60_000, NOW).known).toBe(false)
  })
})

describe('getPartsByZone', () => {
  it('groups parts by area, ranks areas by their worst part, and keeps known before needs-info', () => {
    const v: Vehicle = {
      id: 'v', make: 'A', model: 'B', year: 2018,
      lastReadingMiles: 80_000, lastReadingDate: '2026-07-04', avgAnnualMiles: 0,
      parts: [
        { id: 'belt', catalogueId: 'timing-belt', fitDate: '2024-01-01', fitMileage: 75_000 }, // Engine bay, ~36%
        { id: 'pads', catalogueId: 'brake-pads-front', fitDate: '2020-01-01', fitMileage: 45_000 }, // Front wheels, red
        { id: 'wipers', catalogueId: 'wiper-blades', fitDate: null, fitMileage: null }, // Windscreen, needs info
        { id: 'discs', catalogueId: 'brake-discs-front', fitDate: null, fitMileage: null }, // Front wheels, needs info
      ],
    }
    const zones = getPartsByZone(v, NOW)

    // Front wheels holds the red part → ranked first; Windscreen (nothing known) → last.
    expect(zones.map((z) => z.zone)).toEqual(['Front wheels', 'Engine bay', 'Windscreen'])

    const front = zones[0]
    expect(front.worstRag).toBe('red')
    expect(front.redCount).toBe(1)
    // Known 'pads' sorts ahead of needs-info 'discs' within the area.
    expect(front.parts.map((p) => p.part.id)).toEqual(['pads', 'discs'])

    expect(zones[2].worstRag).toBeNull() // Windscreen: only a needs-info part
  })
})

describe('getPartsWithHealth', () => {
  it('splits known/needs-info and sorts known by most-consumed first', () => {
    const v: Vehicle = {
      id: 'v', make: 'A', model: 'B', year: 2018,
      lastReadingMiles: 80_000, lastReadingDate: '2026-07-04', avgAnnualMiles: 0,
      parts: [
        { id: 'a', catalogueId: 'brake-pads-front', fitDate: '2026-01-01', fitMileage: 78_000 }, // ~7% used
        { id: 'b', catalogueId: 'brake-pads-front', fitDate: '2020-01-01', fitMileage: 55_000 }, // ~83% used
        { id: 'c', catalogueId: 'brake-pads-front', fitDate: null, fitMileage: null }, // needs info
        { id: 'd', catalogueId: 'not-a-real-part', fitDate: '2026-01-01', fitMileage: 78_000 }, // dropped
      ],
    }
    const { known, needsInfo } = getPartsWithHealth(v, NOW)
    expect(known.map((k) => k.part.id)).toEqual(['b', 'a'])
    expect(needsInfo.map((k) => k.part.id)).toEqual(['c'])
  })
})

describe('vehicleWorstRag', () => {
  // avgAnnualMiles 0 + lastReadingDate = NOW's date → current mileage is exactly lastReadingMiles.
  function vehicle(parts: Vehicle['parts']): Vehicle {
    return {
      id: 'v', make: 'A', model: 'B', year: 2018,
      lastReadingMiles: 80_000, lastReadingDate: '2026-07-04', avgAnnualMiles: 0,
      parts,
    }
  }

  it('is null when no part has recorded fitment', () => {
    const v = vehicle([
      { id: 'a', catalogueId: 'brake-pads-front', fitDate: null, fitMileage: null },
      { id: 'b', catalogueId: 'wiper-blades', fitDate: null, fitMileage: null },
    ])
    expect(vehicleWorstRag(v, NOW)).toBeNull()
  })

  it('returns the worst RAG across every zone (red beats amber beats green)', () => {
    const v = vehicle([
      { id: 'oil', catalogueId: 'engine-oil', fitDate: '2026-06-01', fitMileage: 79_000 }, // green
      { id: 'wipers', catalogueId: 'wiper-blades', fitDate: '2025-08-01', fitMileage: 0 }, // ~92% age → amber
      { id: 'pads', catalogueId: 'brake-pads-front', fitDate: '2026-06-01', fitMileage: 45_000 }, // 35k/30k → red
    ])
    expect(vehicleWorstRag(v, NOW)).toBe('red')
  })

  it('ignores needs-info parts when ranking', () => {
    const v = vehicle([
      { id: 'wipers', catalogueId: 'wiper-blades', fitDate: '2025-08-01', fitMileage: 0 }, // ~92% age → amber
      { id: 'pads', catalogueId: 'brake-pads-front', fitDate: null, fitMileage: null }, // needs info, ignored
    ])
    expect(vehicleWorstRag(v, NOW)).toBe('amber')
  })
})
