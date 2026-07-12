import type { AppState, FittedPart, HistoryEntry, Vehicle } from './types.ts'
import { PART_CATALOGUE } from './data/partsCatalogue.ts'
import { originalFitment } from './health.ts'

export function uid(): string {
  return crypto.randomUUID()
}

/** Fields supplied when adding a vehicle (ids/derived data are filled in here). */
export type NewVehicle = {
  make: string
  model: string
  year: number
  reg?: string
  currentMileage: number // becomes the first odometer reading
  currentDate: string // ISO date of that reading
  avgAnnualMiles: number
}

export type Action =
  | { type: 'addVehicle'; vehicle: NewVehicle }
  | { type: 'updateVehicle'; id: string; patch: Partial<Pick<Vehicle, 'make' | 'model' | 'year' | 'reg' | 'avgAnnualMiles'>> }
  | { type: 'deleteVehicle'; id: string }
  | { type: 'setActiveVehicle'; id: string }
  | { type: 'recordReading'; vehicleId: string; miles: number; date: string }
  | { type: 'setPartFitment'; vehicleId: string; partId: string; fitDate: string; fitMileage: number }
  | { type: 'replacePart'; vehicleId: string; partId: string; fitDate: string; fitMileage: number; note?: string }
  | { type: 'addHistoryEntry'; vehicleId: string; kind: 'service' | 'mot' | 'repair'; date: string; mileage: number | null; note?: string; motResult?: 'pass' | 'fail' }
  | { type: 'removeHistoryEntry'; vehicleId: string; entryId: string }
  | { type: 'addPart'; vehicleId: string; catalogueId: string; fitDate: string | null; fitMileage: number | null }
  | { type: 'removePart'; vehicleId: string; partId: string }

/**
 * A fresh vehicle is pre-populated with every catalogue part, each assumed original
 * (fitted from new) until the owner records an actual fit date.
 */
function seedParts(year: number): FittedPart[] {
  return PART_CATALOGUE.map((cat) => ({
    id: uid(),
    catalogueId: cat.id,
    ...originalFitment(year),
  }))
}

function updateVehicle(state: AppState, id: string, fn: (v: Vehicle) => Vehicle): AppState {
  return { ...state, vehicles: state.vehicles.map((v) => (v.id === id ? fn(v) : v)) }
}

/**
 * Move the odometer anchor to a newly-logged reading, but only when it is at least as
 * recent as the current anchor — so back-dating an event never drags the estimate
 * backwards. ISO yyyy-mm-dd dates compare correctly as strings.
 */
function reAnchor(v: Vehicle, miles: number | null, date: string): Vehicle {
  if (miles === null || date < v.lastReadingDate) return v
  return { ...v, lastReadingMiles: miles, lastReadingDate: date }
}

export function garageReducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'addVehicle': {
      const n = action.vehicle
      const vehicle: Vehicle = {
        id: uid(),
        make: n.make.trim(),
        model: n.model.trim(),
        year: n.year,
        ...(n.reg?.trim() ? { reg: n.reg.trim() } : {}),
        lastReadingMiles: n.currentMileage,
        lastReadingDate: n.currentDate,
        avgAnnualMiles: n.avgAnnualMiles,
        parts: seedParts(n.year),
        // Seed the timeline with the starting odometer reading.
        history: [{ id: uid(), kind: 'reading', date: n.currentDate, mileage: n.currentMileage }],
      }
      return { ...state, vehicles: [...state.vehicles, vehicle], activeVehicleId: vehicle.id }
    }

    case 'updateVehicle':
      return updateVehicle(state, action.id, (v) => ({ ...v, ...action.patch }))

    case 'deleteVehicle': {
      const vehicles = state.vehicles.filter((v) => v.id !== action.id)
      const activeVehicleId =
        state.activeVehicleId === action.id ? (vehicles[0]?.id ?? null) : state.activeVehicleId
      return { ...state, vehicles, activeVehicleId }
    }

    case 'setActiveVehicle':
      return { ...state, activeVehicleId: action.id }

    case 'recordReading':
      return updateVehicle(state, action.vehicleId, (v) => {
        const entry: HistoryEntry = { id: uid(), kind: 'reading', date: action.date, mileage: action.miles }
        return reAnchor({ ...v, history: [...v.history, entry] }, action.miles, action.date)
      })

    case 'setPartFitment':
      return updateVehicle(state, action.vehicleId, (v) => ({
        ...v,
        parts: v.parts.map((p) =>
          p.id === action.partId
            ? { ...p, fitDate: action.fitDate, fitMileage: action.fitMileage }
            : p,
        ),
      }))

    case 'replacePart':
      return updateVehicle(state, action.vehicleId, (v) => {
        const part = v.parts.find((p) => p.id === action.partId)
        const entry: HistoryEntry = {
          id: uid(),
          kind: 'replacement',
          date: action.fitDate,
          mileage: action.fitMileage,
          partId: action.partId,
          ...(part ? { catalogueId: part.catalogueId } : {}),
          ...(action.note?.trim() ? { note: action.note.trim() } : {}),
        }
        const parts = v.parts.map((p) =>
          p.id === action.partId ? { ...p, fitDate: action.fitDate, fitMileage: action.fitMileage } : p,
        )
        return reAnchor({ ...v, parts, history: [...v.history, entry] }, action.fitMileage, action.fitDate)
      })

    case 'addHistoryEntry':
      return updateVehicle(state, action.vehicleId, (v) => {
        const entry: HistoryEntry = {
          id: uid(),
          kind: action.kind,
          date: action.date,
          mileage: action.mileage,
          ...(action.note?.trim() ? { note: action.note.trim() } : {}),
          ...(action.motResult ? { motResult: action.motResult } : {}),
        }
        return reAnchor({ ...v, history: [...v.history, entry] }, action.mileage, action.date)
      })

    case 'removeHistoryEntry':
      return updateVehicle(state, action.vehicleId, (v) => ({
        ...v,
        history: v.history.filter((h) => h.id !== action.entryId),
      }))

    case 'addPart':
      return updateVehicle(state, action.vehicleId, (v) => {
        // An un-dated add is assumed original (fitted from new); otherwise use the supplied fitment.
        const fitment =
          action.fitDate === null || action.fitMileage === null
            ? originalFitment(v.year)
            : { fitDate: action.fitDate, fitMileage: action.fitMileage }
        return { ...v, parts: [...v.parts, { id: uid(), catalogueId: action.catalogueId, ...fitment }] }
      })

    case 'removePart':
      return updateVehicle(state, action.vehicleId, (v) => ({
        ...v,
        parts: v.parts.filter((p) => p.id !== action.partId),
      }))

    default:
      return state
  }
}
