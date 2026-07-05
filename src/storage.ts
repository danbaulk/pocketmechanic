import type { AppState } from './types.ts'

const STORAGE_KEY = 'pocketmechanic:state'
const CURRENT_VERSION = 1 as const

export function defaultState(): AppState {
  return { version: CURRENT_VERSION, vehicles: [], activeVehicleId: null }
}

/**
 * Validate/upgrade a parsed blob. No migrations exist yet, so an unknown version is
 * rejected (→ defaults); a current-version blob has its top-level shape checked and
 * its activeVehicleId healed if it points at a missing vehicle.
 */
export function normalizeState(parsed: unknown): AppState | null {
  if (!parsed || typeof parsed !== 'object') return null
  const candidate = parsed as Partial<AppState>
  if (candidate.version !== CURRENT_VERSION || !Array.isArray(candidate.vehicles)) {
    return null
  }
  const vehicles = candidate.vehicles
  let activeVehicleId = candidate.activeVehicleId ?? null
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
