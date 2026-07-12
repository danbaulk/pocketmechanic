import { describe, it, expect } from 'vitest'
import { garageReducer, type Action } from './reducer.ts'
import { defaultState, normalizeState } from './storage.ts'
import { PART_CATALOGUE } from './data/partsCatalogue.ts'
import { computePartHealth } from './health.ts'
import { getCataloguePart } from './data/partsCatalogue.ts'
import type { AppState } from './types.ts'

function run(state: AppState, ...actions: Action[]): AppState {
  return actions.reduce(garageReducer, state)
}

const NEW_CAR: Action = {
  type: 'addVehicle',
  vehicle: {
    make: 'Ford', model: 'Focus', year: 2018,
    currentMileage: 54_200, currentDate: '2026-07-04', avgAnnualMiles: 7000,
  },
}

describe('addVehicle', () => {
  it('adds a vehicle, makes it active, and pre-populates every catalogue part as original fitment', () => {
    const s = run(defaultState(), NEW_CAR)
    expect(s.vehicles).toHaveLength(1)
    const v = s.vehicles[0]
    expect(s.activeVehicleId).toBe(v.id)
    expect(v.lastReadingMiles).toBe(54_200)
    expect(v.parts).toHaveLength(PART_CATALOGUE.length)
    // Un-dated parts are assumed original: fitted from new (0 miles) at the car's year start.
    expect(v.parts.every((p) => p.fitMileage === 0 && p.fitDate === '2018-01-01')).toBe(true)
    // Seeds the timeline with the starting odometer reading.
    expect(v.history).toEqual([expect.objectContaining({ kind: 'reading', mileage: 54_200, date: '2026-07-04' })])
  })
})

describe('setPartFitment', () => {
  it('records fitment (part becomes known and green) and re-setting resets the clock', () => {
    let s = run(defaultState(), NEW_CAR)
    const v = s.vehicles[0]
    const pads = v.parts.find((p) => p.catalogueId === 'brake-pads-front')!
    const cat = getCataloguePart('brake-pads-front')!
    const now = new Date('2026-07-04T12:00:00Z')

    // Fitted long ago at low mileage → red.
    s = run(s, { type: 'setPartFitment', vehicleId: v.id, partId: pads.id, fitDate: '2016-01-01', fitMileage: 20_000 })
    let p = s.vehicles[0].parts.find((x) => x.id === pads.id)!
    expect(computePartHealth(p, cat, 54_200, now).rag).toBe('red')

    // "Replaced" today at current mileage → resets to green.
    s = run(s, { type: 'setPartFitment', vehicleId: v.id, partId: pads.id, fitDate: '2026-07-04', fitMileage: 54_200 })
    p = s.vehicles[0].parts.find((x) => x.id === pads.id)!
    const h = computePartHealth(p, cat, 54_200, now)
    expect(h.known).toBe(true)
    expect(h.rag).toBe('green')
  })
})

describe('recordReading', () => {
  it('re-anchors the odometer and logs a reading entry', () => {
    let s = run(defaultState(), NEW_CAR)
    const v = s.vehicles[0]
    s = run(s, { type: 'recordReading', vehicleId: v.id, miles: 60_000, date: '2026-12-01' })
    expect(s.vehicles[0].lastReadingMiles).toBe(60_000)
    expect(s.vehicles[0].lastReadingDate).toBe('2026-12-01')
    expect(s.vehicles[0].history.at(-1)).toMatchObject({ kind: 'reading', mileage: 60_000, date: '2026-12-01' })
  })

  it('logs a back-dated reading without dragging the anchor backwards', () => {
    let s = run(defaultState(), NEW_CAR) // anchored 54,200 @ 2026-07-04
    const v = s.vehicles[0]
    s = run(s, { type: 'recordReading', vehicleId: v.id, miles: 40_000, date: '2024-01-01' })
    expect(s.vehicles[0].lastReadingMiles).toBe(54_200)
    expect(s.vehicles[0].lastReadingDate).toBe('2026-07-04')
    expect(s.vehicles[0].history.at(-1)).toMatchObject({ kind: 'reading', mileage: 40_000 })
  })
})

describe('replacePart', () => {
  it('logs a replacement entry and resets the clock to green', () => {
    let s = run(defaultState(), NEW_CAR)
    const v = s.vehicles[0]
    const pads = v.parts.find((p) => p.catalogueId === 'brake-pads-front')!
    const cat = getCataloguePart('brake-pads-front')!
    const now = new Date('2026-07-04T12:00:00Z')

    // Old fitment → red (silent set, no log).
    s = run(s, { type: 'setPartFitment', vehicleId: v.id, partId: pads.id, fitDate: '2016-01-01', fitMileage: 20_000 })
    const before = s.vehicles[0].history.length

    // Log a replacement today → resets to green and appends one entry.
    s = run(s, { type: 'replacePart', vehicleId: v.id, partId: pads.id, fitDate: '2026-07-04', fitMileage: 54_200, note: 'new pads' })
    const v2 = s.vehicles[0]
    const p = v2.parts.find((x) => x.id === pads.id)!
    expect(computePartHealth(p, cat, 54_200, now).rag).toBe('green')
    expect(v2.history).toHaveLength(before + 1)
    expect(v2.history.at(-1)).toMatchObject({
      kind: 'replacement',
      partId: pads.id,
      catalogueId: 'brake-pads-front',
      note: 'new pads',
    })
  })
})

describe('addHistoryEntry', () => {
  it('appends the entry and re-anchors when the mileage is the newest', () => {
    let s = run(defaultState(), NEW_CAR)
    const v = s.vehicles[0]
    s = run(s, { type: 'addHistoryEntry', vehicleId: v.id, kind: 'service', date: '2026-09-01', mileage: 58_000, note: 'full service' })
    const v2 = s.vehicles[0]
    expect(v2.lastReadingMiles).toBe(58_000)
    expect(v2.lastReadingDate).toBe('2026-09-01')
    expect(v2.history.at(-1)).toMatchObject({ kind: 'service', mileage: 58_000, note: 'full service' })
  })

  it('does not re-anchor a back-dated entry', () => {
    let s = run(defaultState(), NEW_CAR)
    const v = s.vehicles[0]
    s = run(s, { type: 'addHistoryEntry', vehicleId: v.id, kind: 'repair', date: '2020-01-01', mileage: 10_000 })
    expect(s.vehicles[0].lastReadingMiles).toBe(54_200)
    expect(s.vehicles[0].lastReadingDate).toBe('2026-07-04')
  })

  it('keeps a mileage-less MOT entry without moving the anchor', () => {
    let s = run(defaultState(), NEW_CAR)
    const v = s.vehicles[0]
    s = run(s, { type: 'addHistoryEntry', vehicleId: v.id, kind: 'mot', date: '2026-08-01', mileage: null, motResult: 'pass' })
    expect(s.vehicles[0].lastReadingMiles).toBe(54_200)
    expect(s.vehicles[0].history.at(-1)).toMatchObject({ kind: 'mot', mileage: null, motResult: 'pass' })
  })
})

describe('removeHistoryEntry', () => {
  it('removes an entry by id', () => {
    let s = run(defaultState(), NEW_CAR)
    const v = s.vehicles[0]
    const seeded = v.history[0]
    s = run(s, { type: 'removeHistoryEntry', vehicleId: v.id, entryId: seeded.id })
    expect(s.vehicles[0].history.find((h) => h.id === seeded.id)).toBeUndefined()
  })
})

describe('addPart / removePart', () => {
  it('adds a part not already fitted and removes by id', () => {
    let s = run(defaultState(), NEW_CAR)
    const v = s.vehicles[0]
    const before = v.parts.length
    s = run(s, { type: 'addPart', vehicleId: v.id, catalogueId: 'brake-pads-front', fitDate: '2026-01-01', fitMileage: 50_000 })
    expect(s.vehicles[0].parts).toHaveLength(before + 1)

    const target = s.vehicles[0].parts[0]
    s = run(s, { type: 'removePart', vehicleId: v.id, partId: target.id })
    expect(s.vehicles[0].parts.find((p) => p.id === target.id)).toBeUndefined()
  })

  it('assumes original fitment when a part is added without a fit date', () => {
    let s = run(defaultState(), NEW_CAR) // NEW_CAR is a 2018 vehicle
    const v = s.vehicles[0]
    s = run(s, { type: 'addPart', vehicleId: v.id, catalogueId: 'brake-pads-front', fitDate: null, fitMileage: null })
    const added = s.vehicles[0].parts.at(-1)!
    expect(added).toMatchObject({ catalogueId: 'brake-pads-front', fitMileage: 0, fitDate: '2018-01-01' })
  })
})

describe('updateVehicle', () => {
  it('patches car details while leaving parts, history and the odometer anchor untouched', () => {
    let s = run(defaultState(), NEW_CAR)
    const v = s.vehicles[0]

    s = run(s, {
      type: 'updateVehicle',
      id: v.id,
      patch: { make: 'Vauxhall', model: 'Astra', year: 2020, reg: 'AB20 XYZ', avgAnnualMiles: 9000 },
    })

    const updated = s.vehicles[0]
    expect(updated).toMatchObject({ make: 'Vauxhall', model: 'Astra', year: 2020, reg: 'AB20 XYZ', avgAnnualMiles: 9000 })
    // Untouched by a details edit.
    expect(updated.parts).toBe(v.parts)
    expect(updated.history).toBe(v.history)
    expect(updated.lastReadingMiles).toBe(v.lastReadingMiles)
    expect(updated.lastReadingDate).toBe(v.lastReadingDate)
  })
})

describe('deleteVehicle', () => {
  it('removes the vehicle and reassigns active to a remaining one', () => {
    let s = run(defaultState(), NEW_CAR, NEW_CAR)
    const [first, second] = s.vehicles
    s = run(s, { type: 'setActiveVehicle', id: first.id })
    s = run(s, { type: 'deleteVehicle', id: first.id })
    expect(s.vehicles).toHaveLength(1)
    expect(s.activeVehicleId).toBe(second.id)
  })
})

describe('storage normalizeState', () => {
  it('round-trips a valid current-version blob', () => {
    const s = run(defaultState(), NEW_CAR)
    const restored = normalizeState(JSON.parse(JSON.stringify(s)))
    expect(restored).toEqual(s)
  })

  it('rejects an unknown version', () => {
    expect(normalizeState({ version: 99, vehicles: [] })).toBeNull()
  })

  it('heals a dangling activeVehicleId', () => {
    const s = run(defaultState(), NEW_CAR)
    const blob = { ...s, activeVehicleId: 'gone' }
    expect(normalizeState(JSON.parse(JSON.stringify(blob)))?.activeVehicleId).toBe(s.vehicles[0].id)
  })

  it('migrates a v1 blob: seeds history from the anchor, preserving data', () => {
    const v1 = {
      version: 1,
      activeVehicleId: 'car-1',
      vehicles: [
        {
          id: 'car-1', make: 'VW', model: 'Golf', year: 2015,
          lastReadingMiles: 80_000, lastReadingDate: '2025-01-01', avgAnnualMiles: 8000,
          parts: [],
        },
      ],
    }
    const migrated = normalizeState(v1)!
    expect(migrated.version).toBe(2)
    const v = migrated.vehicles[0]
    expect(v).toMatchObject({ make: 'VW', model: 'Golf', avgAnnualMiles: 8000 })
    expect(v.history).toEqual([
      expect.objectContaining({ kind: 'reading', mileage: 80_000, date: '2025-01-01' }),
    ])
    expect(migrated.activeVehicleId).toBe('car-1')
  })

  it('heals a v2 vehicle missing its history array', () => {
    const s = run(defaultState(), NEW_CAR)
    const blob = { ...s, vehicles: s.vehicles.map((v) => ({ ...v, history: undefined })) }
    expect(normalizeState(JSON.parse(JSON.stringify(blob)))?.vehicles[0].history).toEqual([])
  })

  it('heals an un-dated part to its assumed-original fitment', () => {
    const s = run(defaultState(), NEW_CAR) // NEW_CAR is a 2018 vehicle
    const blob = {
      ...s,
      vehicles: s.vehicles.map((v) => ({
        ...v,
        parts: v.parts.map((p, i) => (i === 0 ? { ...p, fitDate: null, fitMileage: null } : p)),
      })),
    }
    const healed = normalizeState(JSON.parse(JSON.stringify(blob)))!
    expect(healed.vehicles[0].parts[0]).toMatchObject({ fitMileage: 0, fitDate: '2018-01-01' })
  })
})
