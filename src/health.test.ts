import { describe, it, expect } from 'vitest'
import {
  computePartHealth,
  effectiveFitment,
  effectiveInspection,
  estimateCurrentMileage,
  getPartsByZone,
  getPartsWithHealth,
  vehicleWorstRag,
} from './health.ts'
import type { FittedPart, HistoryEntry, Vehicle } from './types.ts'
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
      history: [],
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
      history: [],
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
    expect(h.wear.driver).toBe('mileage')
    expect(h.wear.milesRemaining).toBe(20_000)
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
    expect(h.wear.milesRemaining).toBe(0)
  })
})

describe('computePartHealth — age clock', () => {
  it('classifies by years since fitting', () => {
    // Fitted 5+ years ago on a 5-year part → red.
    const h = computePartHealth(part({ fitDate: '2021-01-01', fitMileage: 0 }), battery, 0, NOW)
    expect(h.wear.driver).toBe('age')
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
    expect(h.wear.driver).toBe('age')
    expect(h.rag).toBe('red')
  })

  it('picks the mileage clock when it is further along than age', () => {
    // Belt: fitted recently by date, but 70k+ miles clocked up → mileage drives, red.
    const h = computePartHealth(part({ fitDate: '2025-01-01', fitMileage: 40_000 }), belt, 111_000, NOW)
    expect(h.wear.driver).toBe('mileage')
    expect(h.rag).toBe('red')
  })
})

describe('computePartHealth — unknown fitment', () => {
  it('returns known:false when the fit date or mileage is missing', () => {
    expect(computePartHealth(part({ fitDate: null }), pads, 60_000, NOW).known).toBe(false)
    expect(computePartHealth(part({ fitMileage: null }), pads, 60_000, NOW).known).toBe(false)
  })
})

describe('effectiveFitment', () => {
  const p = part({ id: 'p1', fitDate: '2020-01-01', fitMileage: 40_000 })
  const ref = [{ partId: 'p1', catalogueId: 'brake-pads-front' }]

  it('uses the most recent job that replaced the part', () => {
    const history: HistoryEntry[] = [
      { id: 'h1', kind: 'service', date: '2023-01-01', mileage: 60_000, partRefs: ref },
      { id: 'h2', kind: 'repair', date: '2025-01-01', mileage: 90_000, partRefs: ref },
    ]
    expect(effectiveFitment(p, history)).toEqual({ fitDate: '2025-01-01', fitMileage: 90_000 })
  })

  it('breaks same-date ties in favour of the later-added entry', () => {
    const history: HistoryEntry[] = [
      { id: 'h1', kind: 'service', date: '2025-01-01', mileage: 90_000, partRefs: ref },
      { id: 'h2', kind: 'repair', date: '2025-01-01', mileage: 95_000, partRefs: ref },
    ]
    expect(effectiveFitment(p, history).fitMileage).toBe(95_000)
  })

  it('falls back to the part\'s own fitment when no job replaced it', () => {
    const history: HistoryEntry[] = [
      { id: 'h1', kind: 'service', date: '2025-01-01', mileage: 90_000, partRefs: [{ partId: 'other', catalogueId: 'x' }] },
    ]
    expect(effectiveFitment(p, history)).toEqual({ fitDate: '2020-01-01', fitMileage: 40_000 })
  })

  it("keeps the part's own fitment when it is newer than every job", () => {
    // Part fitted 2026; history back-filled with an older job that also replaced it.
    const fresh = part({ id: 'p1', fitDate: '2026-01-01', fitMileage: 78_000 })
    const history: HistoryEntry[] = [
      { id: 'h1', kind: 'repair', date: '2020-01-01', mileage: 30_000, partRefs: ref },
    ]
    expect(effectiveFitment(fresh, history)).toEqual({ fitDate: '2026-01-01', fitMileage: 78_000 })
  })

  it('ignores replacement entries that carry no mileage', () => {
    const history: HistoryEntry[] = [
      { id: 'h1', kind: 'mot', date: '2025-01-01', mileage: null, partRefs: ref },
    ]
    expect(effectiveFitment(p, history)).toEqual({ fitDate: '2020-01-01', fitMileage: 40_000 })
  })
})

describe('effectiveInspection', () => {
  const ref = [{ partId: 'p1', catalogueId: 'brake-pads-front' }]
  const p = part({ id: 'p1' })

  it('uses the most recent entry that checked the part', () => {
    const history: HistoryEntry[] = [
      { id: 'h1', kind: 'inspection', date: '2025-01-01', mileage: 90_000, checkedRefs: ref },
      { id: 'h2', kind: 'service', date: '2026-01-01', mileage: 95_000, checkedRefs: ref },
    ]
    expect(effectiveInspection(p, history, '2020-01-01')).toEqual({ date: '2026-01-01', mileage: 95_000 })
  })

  it('is null when nothing has checked the part', () => {
    const history: HistoryEntry[] = [
      { id: 'h1', kind: 'inspection', date: '2025-01-01', mileage: 90_000, checkedRefs: [{ partId: 'other', catalogueId: 'x' }] },
      // A job that *replaced* p1 is not a check.
      { id: 'h2', kind: 'service', date: '2025-06-01', mileage: 92_000, partRefs: ref },
    ]
    expect(effectiveInspection(p, history, '2020-01-01')).toBeNull()
  })

  it('ignores a check that carries no mileage (nothing to measure the extension from)', () => {
    const history: HistoryEntry[] = [
      { id: 'h1', kind: 'mot', date: '2025-01-01', mileage: null, checkedRefs: ref },
    ]
    expect(effectiveInspection(p, history, '2020-01-01')).toBeNull()
  })

  it('ignores a check that predates the fitment - it inspected the part fitted before this one', () => {
    const history: HistoryEntry[] = [
      { id: 'h1', kind: 'inspection', date: '2019-01-01', mileage: 30_000, checkedRefs: ref },
    ]
    expect(effectiveInspection(p, history, '2020-01-01')).toBeNull()
  })

  it('ignores a check dated the same day the part was replaced', () => {
    // They looked at it and then replaced it anyway: the check is moot.
    const history: HistoryEntry[] = [
      { id: 'h1', kind: 'service', date: '2020-01-01', mileage: 40_000, checkedRefs: ref },
    ]
    expect(effectiveInspection(p, history, '2020-01-01')).toBeNull()
  })

  it('does not let a check through on an un-dated fitment', () => {
    const history: HistoryEntry[] = [
      { id: 'h1', kind: 'inspection', date: '2025-01-01', mileage: 90_000, checkedRefs: ref },
    ]
    // A null fitDate can't be compared, so the check stands - but the part is known:false
    // anyway, so computePartHealth never consults it.
    expect(effectiveInspection(p, history, null)).toEqual({ date: '2025-01-01', mileage: 90_000 })
    expect(computePartHealth(part({ fitDate: null }), pads, 90_000, NOW, { date: '2025-01-01', mileage: 90_000 }).known).toBe(false)
  })
})

describe('computePartHealth - a passed inspection extends the part\'s life', () => {
  it('extends from where the part stood at the check, not from its interval', () => {
    // Pads: 41k of 30k used = 137% → red. Checked at 90k (40k used), buying 7.5k (25% of 30k)
    // more: an extended life of 47.5k, of which 41k is used = 86% → green.
    const h = computePartHealth(part({ fitMileage: 50_000 }), pads, 91_000, NOW, { date: '2026-06-04', mileage: 90_000 })
    expect(h.rag).toBe('green')
    expect(h.inspected?.extended.fraction).toBeCloseTo(41_000 / 47_500)
    expect(h.inspected?.extended.milesRemaining).toBe(6500)
    // The part is still 137% through its usual interval and says so.
    expect(h.wear.fraction).toBeCloseTo(41 / 30)
  })

  it('leaves a part that is not flagged yet completely alone', () => {
    // 10k of 30k used = 33%: nothing to rescue, so the check is just a timeline record.
    // Extending here would redraw the part as fresher than it is.
    const h = computePartHealth(part({ fitMileage: 50_000 }), pads, 60_000, NOW, { date: '2026-06-04', mileage: 59_000 })
    expect(h.inspected).toBeUndefined()
    expect(h.rag).toBe('green')
    expect(h.wear.fraction).toBeCloseTo(1 / 3)
  })

  it('goes amber in the last 10% of the extended life', () => {
    // Checked at 90k (40k used) → extended life 47.5k. 43k used = 90.5% of it.
    const h = computePartHealth(part({ fitMileage: 50_000 }), pads, 93_000, NOW, { date: '2026-06-04', mileage: 90_000 })
    expect(h.rag).toBe('amber')
    expect(h.inspected).toBeDefined()
  })

  it('reds once the extension is used up, keeping the record of the check', () => {
    // 47.5k used of the 47.5k extended life: the extension is spent. Unlike a temporary hold,
    // the extension stays on the record - the part is simply past even its extended life.
    const h = computePartHealth(part({ fitMileage: 50_000 }), pads, 97_500, NOW, { date: '2026-06-04', mileage: 90_000 })
    expect(h.rag).toBe('red')
    expect(h.inspected).toBeDefined()
    expect(h.inspected?.extended.milesRemaining).toBe(0)
  })

  it('extends an age-only part on its age clock alone', () => {
    // Battery: 5-year part fitted 2021, now 5.5 years old → red. Checked at 5.0 years,
    // buying 1.25 more (25% of 5) → an extended life of 6.25 years, 5.5 of it used = 88%.
    const h = computePartHealth(part({ fitDate: '2021-01-01', fitMileage: 0 }), battery, 0, NOW, { date: '2026-01-01', mileage: 0 })
    expect(h.rag).toBe('green')
    expect(h.inspected?.extended.driver).toBe('age')
    expect(h.inspected?.extended.milesRemaining).toBeUndefined() // no mileage interval to report
    expect(h.inspected?.extended.fraction).toBeCloseTo(5.5 / 6.25, 2)
  })

  it('takes the soonest of the extended clocks, like the wear clock does', () => {
    // Belt (70k/7yr): fitted 2018 and checked in 2022 at 4.5 years, buying 1.75 more (25% of 7)
    // → an extended age life of 6.25 years, but the part is now 8.5 → red on age, despite the
    // mileage clock having plenty left.
    const h = computePartHealth(part({ fitDate: '2018-01-01', fitMileage: 100_000 }), belt, 111_000, NOW, { date: '2022-07-04', mileage: 110_000 })
    expect(h.rag).toBe('red')
    expect(h.inspected?.extended.driver).toBe('age')
  })

  it('lets a later re-check buy another extension', () => {
    // Checked at 90k → extended to 47.5k, which 47k of use has nearly spent (amber). A fresh
    // check at 97k (47k used) extends again to 54.5k → 86% → green.
    const p = part({ fitMileage: 50_000 })
    expect(computePartHealth(p, pads, 97_000, NOW, { date: '2026-06-04', mileage: 90_000 }).rag).toBe('amber')
    expect(computePartHealth(p, pads, 97_000, NOW, { date: '2026-07-04', mileage: 97_000 }).rag).toBe('green')
  })
})

describe('getPartsByZone - an inspected part sorts on its extended life', () => {
  it('drops an inspected part below a genuinely due one, and de-reds its zone', () => {
    const v: Vehicle = {
      id: 'v', make: 'A', model: 'B', year: 2018,
      lastReadingMiles: 92_000, lastReadingDate: '2026-07-04', avgAnnualMiles: 0,
      parts: [
        // Both are way past their interval; only 'checked' has been inspected.
        { id: 'checked', catalogueId: 'brake-pads-front', fitDate: '2018-01-01', fitMileage: 50_000 },
        { id: 'discs', catalogueId: 'brake-discs-front', fitDate: '2018-01-01', fitMileage: 0 },
      ],
      history: [
        { id: 'h1', kind: 'inspection', date: '2026-07-01', mileage: 91_000, checkedRefs: [{ partId: 'checked', catalogueId: 'brake-pads-front' }] },
      ],
    }
    const front = getPartsByZone(v, NOW).find((z) => z.zone === 'Front wheels')!
    // The un-inspected part is the one that still needs attention, so it leads.
    expect(front.parts.map((p) => p.part.id)).toEqual(['discs', 'checked'])
    expect(front.redCount).toBe(1)
  })
})

describe('getPartsByZone - derives health from replacement history', () => {
  it('a job that replaces a worn part flips it to green', () => {
    const v: Vehicle = {
      id: 'v', make: 'A', model: 'B', year: 2018,
      lastReadingMiles: 80_000, lastReadingDate: '2026-07-04', avgAnnualMiles: 0,
      parts: [{ id: 'pads', catalogueId: 'brake-pads-front', fitDate: '2018-01-01', fitMileage: 0 }],
      history: [
        { id: 'h1', kind: 'service', date: '2026-07-04', mileage: 80_000, partRefs: [{ partId: 'pads', catalogueId: 'brake-pads-front' }] },
      ],
    }
    const front = getPartsByZone(v, NOW).find((z) => z.zone === 'Front wheels')!
    expect(front.parts[0].health.rag).toBe('green')
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
      history: [],
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
      history: [],
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
      history: [],
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
