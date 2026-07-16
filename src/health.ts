import type { FittedPart, HistoryEntry, RAG, Vehicle } from './types.ts'
import { getCataloguePart, ZONE_ORDER, type CataloguePart, type PartZone } from './data/partsCatalogue.ts'
import { latestByDate } from './history.ts'

/**
 * Fraction-of-life at which a part turns amber (flat 10%-remaining for every part).
 * Whether safety-critical parts should go amber earlier is a parked open question.
 */
export const AMBER_THRESHOLD = 0.9

const MS_PER_DAY = 1000 * 60 * 60 * 24
const DAYS_PER_YEAR = 365.25

export function daysBetween(from: Date, to: Date): number {
  return (to.getTime() - from.getTime()) / MS_PER_DAY
}

/** An un-dated part is assumed original: fitted from new (0 miles) at the car's year start. */
export function originalFitment(year: number): { fitDate: string; fitMileage: number } {
  return { fitDate: `${year}-01-01`, fitMileage: 0 }
}

/**
 * A part's effective wear-clock anchor, derived from history: the most recent job that
 * replaced it (the shared `latestByDate` rule). Only entries carrying a mileage can re-anchor
 * the clock. The part's own recorded fitment acts as a floor - it wins when it is newer than
 * every such job, so back-filling old history can't age a part that was fitted more recently -
 * and is the fallback when no job has replaced it.
 */
export function effectiveFitment(
  part: FittedPart,
  history: HistoryEntry[],
): { fitDate: string | null; fitMileage: number | null } {
  const own = { fitDate: part.fitDate, fitMileage: part.fitMileage }
  const jobs = history.filter(
    (h): h is HistoryEntry & { mileage: number } =>
      h.mileage !== null && (h.partRefs?.some((r) => r.partId === part.id) ?? false),
  )
  const best = latestByDate(jobs, (h) => h.date)
  if (best === null) return own
  if (own.fitDate !== null && own.fitMileage !== null && own.fitDate > best.date) return own
  return { fitDate: best.date, fitMileage: best.mileage }
}

/**
 * Estimate the vehicle's current odometer ("electricity-meter" model): the last
 * actual reading plus average annual mileage projected over the days since.
 * Never estimates backwards below the last actual reading.
 */
export function estimateCurrentMileage(v: Vehicle, now: Date): number {
  const days = daysBetween(new Date(v.lastReadingDate), now)
  const projected = v.lastReadingMiles + (v.avgAnnualMiles * days) / DAYS_PER_YEAR
  return Math.max(v.lastReadingMiles, Math.round(projected))
}

export type PartHealth = {
  /** false when fit info is missing — the part renders as "needs info", no RAG. */
  known: boolean
  /** Consumed fraction of life (max of the mileage and age clocks). 0 = new, ≥1 = due. */
  fraction: number
  rag: RAG
  /** Which clock is closest to end-of-life. */
  driver: 'mileage' | 'age'
  milesRemaining?: number
  daysRemaining?: number
}

function ragFor(fraction: number): RAG {
  if (fraction >= 1) return 'red'
  if (fraction >= AMBER_THRESHOLD) return 'amber'
  return 'green'
}

/**
 * Compute a fitted part's health against the current mileage and date, using the
 * soonest of its mileage and age clocks. A part with unrecorded fitment is `known:
 * false` (we can't judge its wear yet).
 */
export function computePartHealth(
  part: FittedPart,
  cat: CataloguePart,
  currentMileage: number,
  now: Date,
): PartHealth {
  if (part.fitDate === null || part.fitMileage === null) {
    return { known: false, fraction: 0, rag: 'green', driver: 'mileage' }
  }

  const milesUsed = currentMileage - part.fitMileage
  const fractionMiles = cat.mileageInterval ? milesUsed / cat.mileageInterval : -Infinity

  const yearsUsed = daysBetween(new Date(part.fitDate), now) / DAYS_PER_YEAR
  const fractionAge = cat.ageYears ? yearsUsed / cat.ageYears : -Infinity

  const driver: 'mileage' | 'age' = fractionMiles >= fractionAge ? 'mileage' : 'age'
  const fraction = Math.max(fractionMiles, fractionAge)

  const health: PartHealth = { known: true, fraction, rag: ragFor(fraction), driver }
  if (cat.mileageInterval) {
    health.milesRemaining = Math.round(cat.mileageInterval - milesUsed)
  }
  if (cat.ageYears) {
    health.daysRemaining = Math.round(cat.ageYears * DAYS_PER_YEAR - yearsUsed * DAYS_PER_YEAR)
  }
  return health
}

export type PartWithHealth = {
  part: FittedPart
  cat: CataloguePart
  health: PartHealth
}

/** Every fitted part (with a known catalogue entry) paired with its computed health. */
function allPartsWithHealth(vehicle: Vehicle, now: Date): PartWithHealth[] {
  const currentMileage = estimateCurrentMileage(vehicle, now)
  const out: PartWithHealth[] = []
  for (const part of vehicle.parts) {
    const cat = getCataloguePart(part.catalogueId)
    if (!cat) continue // catalogueId no longer in the catalogue (e.g. removed part)
    // Health runs against the part's effective fitment (latest replacement job), not its
    // originally-recorded one - so editing/deleting a job re-derives its parts' health.
    const eff = effectiveFitment(part, vehicle.history)
    out.push({ part, cat, health: computePartHealth({ ...part, ...eff }, cat, currentMileage, now) })
  }
  return out
}

/** Known parts sorted soonest-due first; then unknown-fitment parts sorted by name. */
function sortForDisplay(items: PartWithHealth[]): PartWithHealth[] {
  const known = items.filter((i) => i.health.known).sort((a, b) => b.health.fraction - a.health.fraction)
  const needsInfo = items.filter((i) => !i.health.known).sort((a, b) => a.cat.name.localeCompare(b.cat.name))
  return [...known, ...needsInfo]
}

/**
 * Every fitted part split into parts with known fitment (sorted soonest-due first) and
 * parts still needing info. Parts whose catalogueId is unknown are dropped.
 */
export function getPartsWithHealth(
  vehicle: Vehicle,
  now: Date,
): { known: PartWithHealth[]; needsInfo: PartWithHealth[] } {
  const all = allPartsWithHealth(vehicle, now)
  return {
    known: all.filter((i) => i.health.known).sort((a, b) => b.health.fraction - a.health.fraction),
    needsInfo: all.filter((i) => !i.health.known).sort((a, b) => a.cat.name.localeCompare(b.cat.name)),
  }
}

export type ZoneGroup = {
  zone: PartZone
  parts: PartWithHealth[] // known first (soonest-due), then needs-info
  /** Worst RAG among the zone's known parts, or null if none are known yet. */
  worstRag: RAG | null
  redCount: number
  amberCount: number
}

/**
 * Parts grouped by their physical area on the car. Areas containing a due/overdue
 * part sort first (by how far through life their worst part is); areas with nothing
 * known yet fall back to the canonical front-to-back order. Mirrors how the Phase 2
 * car avatar will colour each section.
 */
export function getPartsByZone(vehicle: Vehicle, now: Date): ZoneGroup[] {
  const all = allPartsWithHealth(vehicle, now)

  const groups = new Map<PartZone, PartWithHealth[]>()
  for (const item of all) {
    const list = groups.get(item.cat.zone) ?? []
    list.push(item)
    groups.set(item.cat.zone, list)
  }

  // How far through life a zone's worst known part is — drives area ordering.
  const worstFraction = new Map<PartZone, number>()
  const result: ZoneGroup[] = []
  for (const [zone, items] of groups) {
    const knownItems = items.filter((i) => i.health.known)
    worstFraction.set(zone, knownItems.reduce((m, i) => Math.max(m, i.health.fraction), -Infinity))
    result.push({
      zone,
      parts: sortForDisplay(items),
      worstRag: knownItems.reduce<RAG | null>((worst, i) => rankRag(i.health.rag, worst), null),
      redCount: knownItems.filter((i) => i.health.rag === 'red').length,
      amberCount: knownItems.filter((i) => i.health.rag === 'amber').length,
    })
  }

  result.sort((a, b) => {
    const fa = worstFraction.get(a.zone)!
    const fb = worstFraction.get(b.zone)!
    if (fb !== fa) return fb - fa
    return ZONE_ORDER.indexOf(a.zone) - ZONE_ORDER.indexOf(b.zone)
  })
  return result
}

/**
 * The single worst RAG across all of a vehicle's zones, or null if nothing is known yet.
 * Backs the garage-bar per-car badge and the avatar's overall tint.
 */
export function vehicleWorstRag(vehicle: Vehicle, now: Date): RAG | null {
  return getPartsByZone(vehicle, now).reduce<RAG | null>(
    (worst, zone) => (zone.worstRag ? rankRag(zone.worstRag, worst) : worst),
    null,
  )
}

const RAG_RANK: Record<RAG, number> = { green: 0, amber: 1, red: 2 }
function rankRag(candidate: RAG, current: RAG | null): RAG {
  if (current === null) return candidate
  return RAG_RANK[candidate] > RAG_RANK[current] ? candidate : current
}
