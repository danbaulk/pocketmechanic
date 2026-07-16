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
 * Derive the odometer anchor from history: the latest dated entry carrying a mileage (ties
 * resolve to the later-added one, matching `getHistory`). ISO yyyy-mm-dd dates compare
 * correctly as strings. Recomputed after every history change, so editing or deleting an
 * entry can never leave the estimate anchored to a reading that no longer exists - the same
 * derive-from-history rule that governs part fitment. Back-dating still can't drag the anchor
 * backwards, because a later entry keeps winning. Falls back to the existing anchor when no
 * entry carries a mileage at all.
 */
function recomputeAnchor(v: Vehicle): Vehicle {
  let best: { date: string; miles: number } | null = null
  for (const h of v.history) {
    if (h.mileage === null) continue
    if (best === null || h.date >= best.date) best = { date: h.date, miles: h.mileage }
  }
  if (best === null) return v
  return { ...v, lastReadingMiles: best.miles, lastReadingDate: best.date }
}

/**
 * Resolve the parts a job replaced into denormalised `PartRef`s. `prevRefs` (the entry's
 * existing refs, when editing) backstops a part since removed from the car: without it, editing
 * an entry would silently erase the record of what it replaced - the very thing denormalising
 * `catalogueId` exists to protect.
 */
function partRefsFor(v: Vehicle, partIds: string[] | undefined, prevRefs: PartRef[] = []): PartRef[] {
  if (!partIds?.length) return []
  const refs: PartRef[] = []
  for (const partId of partIds) {
    const catalogueId =
      v.parts.find((p) => p.id === partId)?.catalogueId ??
      prevRefs.find((r) => r.partId === partId)?.catalogueId
    if (catalogueId) refs.push({ partId, catalogueId })
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
  prevRefs?: PartRef[],
): HistoryEntry {
  const partRefs = partRefsFor(v, fields.partIds, prevRefs)
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
        return recomputeAnchor({ ...v, history: [...v.history, entry] })
      })

    case 'addHistoryEntry':
      return updateVehicle(state, action.vehicleId, (v) => {
        const entry = buildJobEntry(v, uid(), action)
        return recomputeAnchor({ ...v, history: [...v.history, entry] })
      })

    case 'updateHistoryEntry':
      return updateVehicle(state, action.vehicleId, (v) => {
        const prev = v.history.find((h) => h.id === action.entryId)
        const entry = buildJobEntry(v, action.entryId, action, prev?.partRefs)
        const history = v.history.map((h) => (h.id === action.entryId ? entry : h))
        return recomputeAnchor({ ...v, history })
      })

    case 'removeHistoryEntry':
      return updateVehicle(state, action.vehicleId, (v) =>
        recomputeAnchor({ ...v, history: v.history.filter((h) => h.id !== action.entryId) }),
      )

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
