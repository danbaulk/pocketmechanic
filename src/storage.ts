import type { AppState, HistoryEntry, Vehicle } from './types.ts'
import { originalFitment } from './health.ts'

const STORAGE_KEY = 'pocketmechanic:state'
const CURRENT_VERSION = 3 as const

export function defaultState(): AppState {
  return { version: CURRENT_VERSION, vehicles: [], activeVehicleId: null }
}

/** A history entry mid-migration: may still carry the pre-v3 single-part `partId`/`catalogueId`. */
type LegacyHistoryEntry = HistoryEntry & { partId?: string; catalogueId?: string }

/** A loosely-typed stored blob mid-migration (older vehicles may predate `history`). */
type StoredBlob = {
  version: number
  vehicles: (Omit<Vehicle, 'history'> & { history?: LegacyHistoryEntry[] })[]
  activeVehicleId: string | null
}

/**
 * Ordered migration steps keyed by the version they upgrade *from*; each returns a blob
 * one version newer. Mirrors the pantry/aroundtheworld step-migrator pattern.
 */
const MIGRATIONS: Record<number, (blob: StoredBlob) => StoredBlob> = {
  // v1 → v2: add the history timeline. Seed one `reading` entry from the vehicle's existing
  // odometer anchor so pre-existing cars don't start with an empty timeline.
  1: (blob) => ({
    ...blob,
    version: 2,
    vehicles: blob.vehicles.map((v) => ({
      ...v,
      history: [
        { id: crypto.randomUUID(), kind: 'reading', date: v.lastReadingDate, mileage: v.lastReadingMiles },
      ],
    })),
  }),
  // v2 → v3: replacements moved from a single `partId`/`catalogueId` to a `partRefs` array (so
  // service/MOT/repair jobs can each carry the parts they replaced). Rewrite legacy entries.
  2: (blob) => ({
    ...blob,
    version: 3,
    vehicles: blob.vehicles.map((v) => ({
      ...v,
      history: (v.history ?? []).map((h) => {
        if (!h.partId) return h
        const { partId, catalogueId, ...rest } = h
        const parts = Array.isArray(v.parts) ? v.parts : []
        const resolved = catalogueId ?? parts.find((p) => p.id === partId)?.catalogueId
        return resolved ? { ...rest, partRefs: [{ partId, catalogueId: resolved }] } : rest
      }),
    })),
  }),
}

function asStoredBlob(parsed: unknown): StoredBlob | null {
  if (!parsed || typeof parsed !== 'object') return null
  const c = parsed as Partial<StoredBlob>
  if (typeof c.version !== 'number' || !Array.isArray(c.vehicles)) return null
  return { version: c.version, vehicles: c.vehicles, activeVehicleId: c.activeVehicleId ?? null }
}

/** Run migration steps until the blob reaches CURRENT_VERSION, or null if there's no path. */
function migrate(parsed: unknown): StoredBlob | null {
  const blob = asStoredBlob(parsed)
  if (!blob) return null
  let current = blob
  while (current.version < CURRENT_VERSION) {
    const step = MIGRATIONS[current.version]
    if (!step) return null // no migration path from this version
    current = step(current)
  }
  if (current.version !== CURRENT_VERSION) return null // newer than we understand → reject
  return current
}

/**
 * Validate/upgrade a parsed blob: migrate older versions forward, heal each vehicle's
 * `history` to an array and any un-dated part to its assumed-original fitment, and
 * repoint `activeVehicleId` if it names a missing vehicle. Unknown or newer-than-current
 * versions fall back to defaults (via a null return).
 */
export function normalizeState(parsed: unknown): AppState | null {
  const migrated = migrate(parsed)
  if (!migrated) return null
  const vehicles: Vehicle[] = migrated.vehicles.map((v) => ({
    ...v,
    history: Array.isArray(v.history) ? v.history : [],
    parts: Array.isArray(v.parts)
      ? v.parts.map((p) =>
          p.fitDate === null || p.fitMileage === null ? { ...p, ...originalFitment(v.year) } : p,
        )
      : [],
  }))
  let activeVehicleId = migrated.activeVehicleId
  if (activeVehicleId !== null && !vehicles.some((v) => v.id === activeVehicleId)) {
    activeVehicleId = vehicles[0]?.id ?? null
  }
  return { version: CURRENT_VERSION, vehicles, activeVehicleId }
}

export function load(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return defaultState()
    return normalizeState(JSON.parse(raw)) ?? defaultState()
  } catch {
    return defaultState()
  }
}

export function save(state: AppState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // Storage unavailable or full — acceptable to drop for a local-only prototype.
  }
}
