/**
 * Built-in reference table of common car parts.
 *
 * Authored as a static, slug-keyed module (decoupled from runtime ids). Each part
 * declares a mileage interval, an age interval, or BOTH — the health engine takes
 * whichever clock is closest to end-of-life (soonest wins). Costs are indicative
 * ranges in £; make/model-specific refinement is deferred to a later phase.
 *
 * `zone` is the part's physical area on the car. It groups the parts list today and
 * will map to clickable sections of the car avatar in Phase 2.
 */

export type PartZone = 'Engine bay' | 'Front wheels' | 'Rear wheels' | 'Underside' | 'Windscreen'

/** Canonical front-to-back ordering, used when areas aren't ranked by urgency. */
export const ZONE_ORDER: PartZone[] = ['Engine bay', 'Front wheels', 'Rear wheels', 'Underside', 'Windscreen']

export type CataloguePart = {
  id: string // stable slug, e.g. 'brake-pads-front'
  name: string
  zone: PartZone
  mileageInterval?: number // miles, if it wears by distance
  ageYears?: number // years, if it wears by time
  costLow: number
  costHigh: number
}

export const PART_CATALOGUE: CataloguePart[] = [
  // Engine bay
  { id: 'engine-oil', name: 'Engine oil & filter', zone: 'Engine bay', mileageInterval: 10_000, ageYears: 1, costLow: 60, costHigh: 150 },
  { id: 'spark-plugs', name: 'Spark plugs', zone: 'Engine bay', mileageInterval: 40_000, ageYears: 5, costLow: 40, costHigh: 120 },
  { id: 'timing-belt', name: 'Timing / cam belt', zone: 'Engine bay', mileageInterval: 70_000, ageYears: 7, costLow: 300, costHigh: 700 },
  { id: 'aux-drive-belt', name: 'Auxiliary drive belt', zone: 'Engine bay', mileageInterval: 60_000, ageYears: 6, costLow: 80, costHigh: 200 },
  { id: 'fuel-filter', name: 'Fuel filter', zone: 'Engine bay', mileageInterval: 25_000, ageYears: 4, costLow: 30, costHigh: 90 },
  { id: 'coolant', name: 'Coolant / antifreeze', zone: 'Engine bay', ageYears: 5, costLow: 40, costHigh: 90 },
  { id: 'battery', name: '12V battery', zone: 'Engine bay', ageYears: 5, costLow: 80, costHigh: 200 },
  { id: 'alternator', name: 'Alternator', zone: 'Engine bay', mileageInterval: 100_000, ageYears: 12, costLow: 150, costHigh: 400 },
  { id: 'brake-fluid', name: 'Brake fluid', zone: 'Engine bay', ageYears: 2, costLow: 30, costHigh: 70 },
  { id: 'ac-refrigerant', name: 'Air-con refrigerant', zone: 'Engine bay', ageYears: 2, costLow: 40, costHigh: 100 },

  // Front wheels
  { id: 'brake-pads-front', name: 'Front brake pads', zone: 'Front wheels', mileageInterval: 30_000, ageYears: 6, costLow: 40, costHigh: 120 },
  { id: 'brake-discs-front', name: 'Front brake discs', zone: 'Front wheels', mileageInterval: 60_000, ageYears: 8, costLow: 80, costHigh: 250 },
  { id: 'tyres-front', name: 'Front tyres', zone: 'Front wheels', mileageInterval: 20_000, ageYears: 6, costLow: 80, costHigh: 300 },
  { id: 'shock-absorbers', name: 'Shock absorbers', zone: 'Front wheels', mileageInterval: 75_000, ageYears: 10, costLow: 150, costHigh: 450 },

  // Rear wheels
  { id: 'brake-pads-rear', name: 'Rear brake pads', zone: 'Rear wheels', mileageInterval: 40_000, ageYears: 7, costLow: 40, costHigh: 120 },
  { id: 'tyres-rear', name: 'Rear tyres', zone: 'Rear wheels', mileageInterval: 25_000, ageYears: 6, costLow: 80, costHigh: 300 },

  // Underside
  { id: 'exhaust', name: 'Exhaust / back box', zone: 'Underside', mileageInterval: 80_000, ageYears: 8, costLow: 100, costHigh: 350 },
  { id: 'clutch', name: 'Clutch', zone: 'Underside', mileageInterval: 80_000, ageYears: 10, costLow: 400, costHigh: 900 },

  // Windscreen
  { id: 'wiper-blades', name: 'Wiper blades', zone: 'Windscreen', ageYears: 1, costLow: 15, costHigh: 40 },
]

const BY_ID = new Map(PART_CATALOGUE.map((p) => [p.id, p]))

export function getCataloguePart(id: string): CataloguePart | undefined {
  return BY_ID.get(id)
}
