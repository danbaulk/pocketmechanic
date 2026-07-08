import type { Vehicle } from '../types.ts'
import type { PartZone } from '../data/partsCatalogue.ts'
import { getPartsWithHealth } from '../health.ts'
import { RAG_STYLES } from '../rag.ts'
import { dueText, formatCost } from '../format.ts'

/**
 * The one part closest to end-of-life, surfaced on open. `known` is already sorted
 * soonest-due-first by the health engine, so `known[0]` is the headline. Tapping jumps
 * to that part's area on the avatar/list.
 */
export function DueSoonest({
  vehicle,
  onFocusZone,
}: {
  vehicle: Vehicle
  onFocusZone: (zone: PartZone) => void
}) {
  const { known } = getPartsWithHealth(vehicle, new Date())
  const soonest = known[0]

  if (!soonest) {
    return (
      <div className="rounded-2xl bg-white p-4 text-sm text-slate-500 shadow-sm ring-1 ring-slate-200">
        Add fitment dates to your parts to see what's due next.
      </div>
    )
  }

  const { cat, health } = soonest
  const styles = RAG_STYLES[health.rag]
  const allHealthy = health.rag === 'green'

  return (
    <button
      type="button"
      onClick={() => onFocusZone(cat.zone)}
      className="w-full rounded-2xl bg-white p-4 text-left shadow-sm ring-1 ring-slate-200 transition-colors hover:bg-slate-50"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-slate-400">
          {allHealthy ? "Everything's healthy" : 'Due soonest'}
        </span>
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${styles.badge}`}>
          {styles.label}
        </span>
      </div>
      <div className="mt-1.5 flex items-baseline justify-between gap-2">
        <span className="font-semibold text-slate-900">{cat.name}</span>
        <span className="shrink-0 text-xs text-slate-400">{formatCost(cat.costLow, cat.costHigh)}</span>
      </div>
      <p className={`mt-0.5 text-sm ${health.rag === 'red' ? 'text-red-600' : 'text-slate-500'}`}>
        {allHealthy ? `Next up - ${dueText(health)}` : dueText(health)}
      </p>
    </button>
  )
}
