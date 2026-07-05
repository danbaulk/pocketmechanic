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
  it('adds a vehicle, makes it active, and pre-populates every catalogue part as unknown-fitment', () => {
    const s = run(defaultState(), NEW_CAR)
    expect(s.vehicles).toHaveLength(1)
    const v = s.vehicles[0]
    expect(s.activeVehicleId).toBe(v.id)
    expect(v.lastReadingMiles).toBe(54_200)
    expect(v.parts).toHaveLength(PART_CATALOGUE.length)
    expect(v.parts.every((p) => p.fitDate === null && p.fitMileage === null)).toBe(true)
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
  it('re-anchors the odometer', () => {
    let s = run(defaultState(), NEW_CAR)
    const v = s.vehicles[0]
    s = run(s, { type: 'recordReading', vehicleId: v.id, miles: 60_000, date: '2026-12-01' })
    expect(s.vehicles[0].lastReadingMiles).toBe(60_000)
    expect(s.vehicles[0].lastReadingDate).toBe('2026-12-01')
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
})
