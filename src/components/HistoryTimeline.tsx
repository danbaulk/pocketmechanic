import type { HistoryKind, Vehicle } from '../types.ts'
import { useGarage } from '../garageContext.ts'
import { entryDetail, getHistory, HISTORY_KIND_META } from '../history.ts'
import { formatDate, formatMiles } from '../format.ts'

const KIND_BADGE: Record<HistoryKind, string> = {
  service: 'bg-sky-50 text-sky-700 ring-sky-200',
  mot: 'bg-violet-50 text-violet-700 ring-violet-200',
  repair: 'bg-orange-50 text-orange-700 ring-orange-200',
  replacement: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  reading: 'bg-slate-100 text-slate-600 ring-slate-200',
}

export function HistoryTimeline({ vehicle }: { vehicle: Vehicle }) {
  const { dispatch } = useGarage()
  const entries = getHistory(vehicle)

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-slate-900">History</h3>
        <button
          type="button"
          onClick={() => window.print()}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Print
        </button>
      </div>

      {entries.length === 0 ? (
        <p className="rounded-2xl bg-white p-4 text-sm text-slate-500 ring-1 ring-slate-200">
          No history yet. Log a service, MOT or repair to start a record.
        </p>
      ) : (
        <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
          {entries.map((entry) => {
            const detail = entryDetail(entry)
            return (
              <li key={entry.id} className="flex items-start gap-3 px-4 py-3">
                <span
                  className={`mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${KIND_BADGE[entry.kind]}`}
                >
                  {HISTORY_KIND_META[entry.kind].label}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-sm font-medium text-slate-900">{formatDate(entry.date)}</span>
                    {entry.mileage !== null && (
                      <span className="shrink-0 text-xs tabular-nums text-slate-400">{formatMiles(entry.mileage)}</span>
                    )}
                  </div>
                  {detail && <p className="mt-0.5 truncate text-sm text-slate-500">{detail}</p>}
                </div>
                <button
                  type="button"
                  onClick={() => dispatch({ type: 'removeHistoryEntry', vehicleId: vehicle.id, entryId: entry.id })}
                  className="shrink-0 rounded-md px-2 py-1 text-xs text-slate-400 hover:bg-slate-100 hover:text-red-600"
                  aria-label="Delete entry"
                >
                  Delete
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
