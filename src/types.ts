export type RAG = 'green' | 'amber' | 'red'

/** A part fitted to a specific vehicle. Links to a CataloguePart by slug. */
export type FittedPart = {
  id: string
  catalogueId: string // slug into PART_CATALOGUE
  fitDate: string | null // ISO date (yyyy-mm-dd); null = fitment not yet recorded
  fitMileage: number | null // odometer reading when fitted; null = not yet recorded
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
}

export type AppState = {
  version: 1 // schema version — bump + migrate in storage.ts on shape changes
  vehicles: Vehicle[]
  activeVehicleId: string | null
}
