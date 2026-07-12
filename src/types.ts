export type RAG = 'green' | 'amber' | 'red'

/** A part fitted to a specific vehicle. Links to a CataloguePart by slug. */
export type FittedPart = {
  id: string
  catalogueId: string // slug into PART_CATALOGUE
  fitDate: string | null // ISO date (yyyy-mm-dd); null = fitment not yet recorded
  fitMileage: number | null // odometer reading when fitted; null = not yet recorded
}

/** A kind of dated event on a vehicle's history timeline. */
export type HistoryKind = 'service' | 'mot' | 'repair' | 'replacement' | 'reading'

/** One dated entry in a vehicle's service/MOT/repair/reading history. */
export type HistoryEntry = {
  id: string
  kind: HistoryKind
  date: string // ISO date (yyyy-mm-dd)
  mileage: number | null // odometer at the event, if known
  note?: string // service description / MOT advisories / repair detail
  // replacement-only:
  partId?: string // the FittedPart replaced
  catalogueId?: string // denormalised so the timeline still renders if the part is later removed
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
  /** Dated service/MOT/repair/replacement/reading events, in insertion order. */
  history: HistoryEntry[]
}

export type AppState = {
  version: 2 // schema version — bump + migrate in storage.ts on shape changes
  vehicles: Vehicle[]
  activeVehicleId: string | null
}
