import type { FittedPart, HistoryEntry, RAG, Vehicle } from './types.ts'
import { getCataloguePart, ZONE_ORDER, type CataloguePart, type PartZone } from './data/partsCatalogue.ts'
import { latestByDate } from './history.ts'

/**
 * Fraction-of-life at which a part turns amber (flat 10%-remaining for every part).
 * Whether safety-critical parts should go amber earlier is a parked open question.
 */
export const AMBER_THRESHOLD = 0.9

/**
 * How much extra life a passed inspection buys a part, as a fraction of its own interval.
 * Scaling with the part keeps one rule for every part: a garage saying the pads are fine
 * means something different on a 25,000-mile interval than on a 70,000-mile one.
 */
export const INSPECTION_EXTENSION = 0.25

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
 * The passed inspection currently vouching for a part, derived from history: the most recent
 * entry that checked it (the shared `latestByDate` rule). Only entries carrying a mileage
 * qualify, since the extension is measured from the odometer at the check.
 *
 * The inspection must *strictly* post-date `fitDate` - the part's effective fitment. Anything
 * dated at or before it inspected the part that was on the car then, not this one: a part
 * replaced the same day it was looked at makes the check moot, and a part in both lists of one
 * entry is a replacement, not a check. Without the strict test an old inspection would lie
 * dormant and then vouch for a fresh part years later, once that part wore far enough for
 * `computePartHealth` to consult it.
 */
export function effectiveInspection(
  part: FittedPart,
  history: HistoryEntry[],
  fitDate: string | null,
): { date: string; mileage: number } | null {
  const checks = history.filter(
    (h): h is HistoryEntry & { mileage: number } =>
      h.mileage !== null && (h.checkedRefs?.some((r) => r.partId === part.id) ?? false),
  )
  const best = latestByDate(checks, (h) => h.date)
  if (best === null) return null
  // An explicit null test: `'2026-01-01' > null` compares numerically and is silently false.
  if (fitDate !== null && best.date <= fitDate) return null
  return { date: best.date, mileage: best.mileage }
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

/**
 * How far through a mileage/age pair of clocks something is, the soonest of the two winning.
 * A part missing one of the two intervals is judged on the other alone: an absent interval
 * scores `-Infinity` so it can never win, and contributes no "remaining" figure.
 */
export type Clock = {
  /** Consumed fraction: 0 = fresh, ≥1 = run out. */
  fraction: number
  /** Which of the two is closest to running out. */
  driver: 'mileage' | 'age'
  milesRemaining?: number
  daysRemaining?: number
}

function computeClock(
  milesUsed: number,
  yearsUsed: number,
  mileageInterval: number | undefined,
  ageYears: number | undefined,
): Clock {
  const fractionMiles = mileageInterval ? milesUsed / mileageInterval : -Infinity
  const fractionAge = ageYears ? yearsUsed / ageYears : -Infinity

  const clock: Clock = {
    fraction: Math.max(fractionMiles, fractionAge),
    driver: fractionMiles >= fractionAge ? 'mileage' : 'age',
  }
  if (mileageInterval) clock.milesRemaining = Math.round(mileageInterval - milesUsed)
  if (ageYears) clock.daysRemaining = Math.round((ageYears - yearsUsed) * DAYS_PER_YEAR)
  return clock
}

export type PartHealth = {
  /** false when fit info is missing - the part renders as "needs info", no RAG. */
  known: boolean
  /** The signal to show. Reads the active clock (see `inspected`). */
  rag: RAG
  /** The part's wear against its nominal life. Always its real wear, inspected or not. */
  wear: Clock
  /**
   * Set when a passed inspection has extended this part's life: when it was checked, and the
   * part's wear against that extended life. Its presence is what makes the extended clock the
   * part's *active* clock in place of `wear` - so `rag` and display order read it, while `wear`
   * still tells the truth about how far past its usual interval the part is.
   */
  inspected?: { date: string; mileage: number; extended: Clock }
}

function ragFor(fraction: number): RAG {
  if (fraction >= 1) return 'red'
  if (fraction >= AMBER_THRESHOLD) return 'amber'
  return 'green'
}

/** The clock that drives a part's signal and display order: its extended life if inspected, else its wear. */
export function activeClock(health: PartHealth): Clock {
  return health.inspected ? health.inspected.extended : health.wear
}

/** The fraction of the part's active clock. */
function urgency(health: PartHealth): number {
  return activeClock(health).fraction
}

/**
 * Compute a fitted part's health against the current mileage and date, using the soonest of
 * its mileage and age clocks. A part with unrecorded fitment is `known: false` (we can't judge
 * its wear yet).
 *
 * A passed `inspection` (from `effectiveInspection`) extends the part's life: a garage has
 * looked at a part we'd otherwise flag and said it isn't done yet. What it vouches for is the
 * part *as it stood that day*, so each clock is extended to where it had got to at the check
 * plus a further `INSPECTION_EXTENSION` of the part's interval - buying the same amount of
 * life whenever it's checked, and letting a later re-check buy more. The part then wears
 * through that extended life and reds normally; nothing about the extension is temporary.
 * `wear` still measures the nominal interval, so the readout can stay candid about a part
 * that's well past it.
 *
 * An inspection of a part we *aren't* flagging (wear below amber) is left as a plain timeline
 * record: extending the life of a healthy part would redraw it as fresher than it is.
 */
export function computePartHealth(
  part: FittedPart,
  cat: CataloguePart,
  currentMileage: number,
  now: Date,
  inspection?: { date: string; mileage: number } | null,
): PartHealth {
  if (part.fitDate === null || part.fitMileage === null) {
    return { known: false, rag: 'green', wear: { fraction: 0, driver: 'mileage' } }
  }

  const milesUsed = currentMileage - part.fitMileage
  const yearsUsed = daysBetween(new Date(part.fitDate), now) / DAYS_PER_YEAR
  const wear = computeClock(milesUsed, yearsUsed, cat.mileageInterval, cat.ageYears)

  if (inspection && wear.fraction >= AMBER_THRESHOLD) {
    const milesAtCheck = inspection.mileage - part.fitMileage
    const yearsAtCheck = daysBetween(new Date(part.fitDate), new Date(inspection.date)) / DAYS_PER_YEAR
    const extended = computeClock(
      milesUsed,
      yearsUsed,
      cat.mileageInterval && milesAtCheck + cat.mileageInterval * INSPECTION_EXTENSION,
      cat.ageYears && yearsAtCheck + cat.ageYears * INSPECTION_EXTENSION,
    )
    return { known: true, rag: ragFor(extended.fraction), wear, inspected: { ...inspection, extended } }
  }

  return { known: true, rag: ragFor(wear.fraction), wear }
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
    // Health runs against the part's effective fitment (latest replacement job) and the
    // inspection vouching for it, not its originally-recorded fitment - so editing/deleting
    // a job re-derives its parts' health.
    const eff = effectiveFitment(part, vehicle.history)
    const inspection = effectiveInspection(part, vehicle.history, eff.fitDate)
    out.push({ part, cat, health: computePartHealth({ ...part, ...eff }, cat, currentMileage, now, inspection) })
  }
  return out
}

/** Known parts sorted soonest-due first; then unknown-fitment parts sorted by name. */
function sortForDisplay(items: PartWithHealth[]): PartWithHealth[] {
  const known = items.filter((i) => i.health.known).sort((a, b) => urgency(b.health) - urgency(a.health))
  const needsInfo = items.filter((i) => !i.health.known).sort((a, b) => a.cat.name.localeCompare(b.cat.name))
  return [...known, ...needsInfo]
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

  // How far through its active clock a zone's worst known part is - drives area ordering.
  const worstFraction = new Map<PartZone, number>()
  const result: ZoneGroup[] = []
  for (const [zone, items] of groups) {
    const knownItems = items.filter((i) => i.health.known)
    worstFraction.set(zone, knownItems.reduce((m, i) => Math.max(m, urgency(i.health)), -Infinity))
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
