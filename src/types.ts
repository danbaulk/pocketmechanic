export type RAG = 'green' | 'amber' | 'red'

/** A part fitted to a specific vehicle. Links to a CataloguePart by slug. */
export type FittedPart = {
  id: string
  catalogueId: string // slug into PART_CATALOGUE
  fitDate: string | null // ISO date (yyyy-mm-dd); null = fitment not yet recorded
  fitMileage: number | null // odometer reading when fitted; null = not yet recorded
}

/** A kind of dated event on a vehicle's history timeline. */
export type HistoryKind = 'service' | 'mot' | 'repair' | 'inspection' | 'replacement' | 'reading'

/**
 * A part referenced by a history entry. The `catalogueId` is denormalised so the timeline
 * still renders the part's name if the FittedPart is later removed from the vehicle.
 */
export type PartRef = { partId: string; catalogueId: string }

/** One dated entry in a vehicle's service/MOT/repair/inspection/reading history. */
export type HistoryEntry = {
  id: string
  kind: HistoryKind
  date: string // ISO date (yyyy-mm-dd)
  mileage: number | null // odometer at the event, if known
  note?: string // service description / MOT advisories / repair detail
  // the parts this job replaced (resets each one's wear clock to this entry's date/mileage):
  partRefs?: PartRef[]
  // the parts this job checked and passed. Unlike `partRefs` this doesn't reset the wear clock -
  // the part is still as old as it was - it extends the part's life instead (see
  // `effectiveInspection`). A part is never in both lists on one entry.
  checkedRefs?: PartRef[]
  // mot-only:
  motResult?: 'pass' | 'fail'
}

export type Vehicle = {
  id: string
  make: string
  model: string
  year: number
  reg?: string
  /** Most recent actual odometer reading — the anchor for mileage estimation. */
  lastReadingMiles: number
  /** ISO date (yyyy-mm-dd) that reading was taken. */
  lastReadingDate: string
  /** Average annual mileage, used to estimate the odometer between readings. */
  avgAnnualMiles: number
  parts: FittedPart[]
  /** Dated service/MOT/repair/inspection/reading events, in insertion order. */
  history: HistoryEntry[]
}

export type AppState = {
  version: 4 // schema version - bump + migrate in storage.ts on shape changes
  vehicles: Vehicle[]
  activeVehicleId: string | null
}
