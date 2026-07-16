import type { Vehicle } from '../types.ts'
import { effectiveFitment, type PartWithHealth } from '../health.ts'
import { getHistory, HISTORY_KIND_META } from '../history.ts'
import { RAG_STYLES } from '../rag.ts'
import { consumedPercent, dueText, formatCost, formatDate, formatMiles } from '../format.ts'
import { Modal } from './Modal.tsx'

/**
 * Detail for a single fitted part: its current health and the history of jobs that replaced
 * it. Each replacement is a button that jumps to (scrolls/highlights) that entry in the
 * timeline via `onJumpToEntry`.
 */
export function PartDetailModal({
  item,
  vehicle,
  onJumpToEntry,
  onClose,
}: {
  item: PartWithHealth
  vehicle: Vehicle
  onJumpToEntry: (entryId: string) => void
  onClose: () => void
}) {
  const { part, cat, health } = item
  const styles = RAG_STYLES[health.rag]
  const fitment = effectiveFitment(part, vehicle.history)

  // Every job that replaced this part, newest-first.
  const replacements = getHistory(vehicle).filter((e) => e.partRefs?.some((r) => r.partId === part.id))

  return (
    <Modal title={cat.name} onClose={onClose}>
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${health.known ? styles.dot : 'bg-slate-300'}`} aria-hidden />
          <span className={`text-sm font-medium ${health.rag === 'red' ? 'text-red-600' : 'text-slate-700'}`}>
            {dueText(health)}
          </span>
          {health.known && <span className="ml-auto text-xs tabular-nums text-slate-400">{consumedPercent(health)}% used</span>}
        </div>

        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <div>
            <dt className="text-xs text-slate-400">Typical cost</dt>
            <dd className="text-slate-700">{formatCost(cat.costLow, cat.costHigh)}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-400">Last fitted</dt>
            <dd className="text-slate-700">
              {fitment.fitDate ? formatDate(fitment.fitDate) : 'Not recorded'}
              {fitment.fitMileage !== null ? ` · ${formatMiles(fitment.fitMileage)}` : ''}
            </dd>
          </div>
        </dl>

        <div>
          <h3 className="mb-1.5 text-sm font-semibold text-slate-900">Replacement history</h3>
          {replacements.length === 0 ? (
            <p className="text-sm text-slate-500">No replacements logged yet.</p>
          ) : (
            <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl ring-1 ring-slate-200">
              {replacements.map((entry) => (
                <li key={entry.id}>
                  <button
                    type="button"
                    onClick={() => onJumpToEntry(entry.id)}
                    className="flex w-full items-baseline justify-between gap-2 px-3 py-2.5 text-left text-sm hover:bg-slate-50"
                  >
                    <span className="text-slate-700">
                      {HISTORY_KIND_META[entry.kind].label} · {formatDate(entry.date)}
                    </span>
                    {entry.mileage !== null && (
                      <span className="shrink-0 text-xs tabular-nums text-slate-400">{formatMiles(entry.mileage)}</span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Modal>
  )
}
