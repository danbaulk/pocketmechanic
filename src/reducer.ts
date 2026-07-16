import type { AppState, FittedPart, HistoryEntry, PartRef, Vehicle } from './types.ts'
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
  | { type: 'addHistoryEntry'; vehicleId: string; kind: 'service' | 'mot' | 'repair'; date: string; mileage: number | null; note?: string; motResult?: 'pass' | 'fail'; partIds?: string[] }
  | { type: 'updateHistoryEntry'; vehicleId: string; entryId: string; kind: 'service' | 'mot' | 'repair'; date: string; mileage: number | null; note?: string; motResult?: 'pass' | 'fail'; partIds?: string[] }
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

/** Resolve the parts a job replaced into denormalised `PartRef`s (unknown ids are dropped). */
function partRefsFor(v: Vehicle, partIds: string[] | undefined): PartRef[] {
  if (!partIds?.length) return []
  const refs: PartRef[] = []
  for (const partId of partIds) {
    const part = v.parts.find((p) => p.id === partId)
    if (part) refs.push({ partId, catalogueId: part.catalogueId })
  }
  return refs
}

/** Build a service/MOT/repair history entry from job fields, denormalising its replaced parts. */
function buildJobEntry(
  v: Vehicle,
  id: string,
  fields: {
    kind: 'service' | 'mot' | 'repair'
    date: string
    mileage: number | null
    note?: string
    motResult?: 'pass' | 'fail'
    partIds?: string[]
  },
): HistoryEntry {
  const partRefs = partRefsFor(v, fields.partIds)
  return {
    id,
    kind: fields.kind,
    date: fields.date,
    mileage: fields.mileage,
    ...(fields.note?.trim() ? { note: fields.note.trim() } : {}),
    ...(fields.motResult && fields.kind === 'mot' ? { motResult: fields.motResult } : {}),
    ...(partRefs.length ? { partRefs } : {}),
  }
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

    case 'addHistoryEntry':
      return updateVehicle(state, action.vehicleId, (v) => {
        const entry = buildJobEntry(v, uid(), action)
        return reAnchor({ ...v, history: [...v.history, entry] }, action.mileage, action.date)
      })

    case 'updateHistoryEntry':
      return updateVehicle(state, action.vehicleId, (v) => {
        const entry = buildJobEntry(v, action.entryId, action)
        const history = v.history.map((h) => (h.id === action.entryId ? entry : h))
        return reAnchor({ ...v, history }, action.mileage, action.date)
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
