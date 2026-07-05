import type { AppState, FittedPart, Vehicle } from './types.ts'
import { PART_CATALOGUE } from './data/partsCatalogue.ts'

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
  | { type: 'addPart'; vehicleId: string; catalogueId: string; fitDate: string | null; fitMileage: number | null }
  | { type: 'removePart'; vehicleId: string; partId: string }

/** A fresh vehicle is pre-populated with every catalogue part, awaiting fitment. */
function seedParts(): FittedPart[] {
  return PART_CATALOGUE.map((cat) => ({
    id: uid(),
    catalogueId: cat.id,
    fitDate: null,
    fitMileage: null,
  }))
}

function updateVehicle(state: AppState, id: string, fn: (v: Vehicle) => Vehicle): AppState {
  return { ...state, vehicles: state.vehicles.map((v) => (v.id === id ? fn(v) : v)) }
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
        parts: seedParts(),
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
      return updateVehicle(state, action.vehicleId, (v) => ({
        ...v,
        lastReadingMiles: action.miles,
        lastReadingDate: action.date,
      }))

    case 'setPartFitment':
      return updateVehicle(state, action.vehicleId, (v) => ({
        ...v,
        parts: v.parts.map((p) =>
          p.id === action.partId
            ? { ...p, fitDate: action.fitDate, fitMileage: action.fitMileage }
            : p,
        ),
      }))

    case 'addPart':
      return updateVehicle(state, action.vehicleId, (v) => ({
        ...v,
        parts: [
          ...v.parts,
          { id: uid(), catalogueId: action.catalogueId, fitDate: action.fitDate, fitMileage: action.fitMileage },
        ],
      }))

    case 'removePart':
      return updateVehicle(state, action.vehicleId, (v) => ({
        ...v,
        parts: v.parts.filter((p) => p.id !== action.partId),
      }))

    default:
      return state
  }
}
