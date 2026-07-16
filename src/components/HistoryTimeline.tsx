import { useEffect, useRef, useState } from 'react'
import type { HistoryEntry, HistoryKind, Vehicle } from '../types.ts'
import { entryDetail, getHistory, HISTORY_KIND_META } from '../history.ts'
import { formatDate, formatMiles } from '../format.ts'
import { HistoryEntryForm } from './HistoryEntryForm.tsx'

const KIND_BADGE: Record<HistoryKind, string> = {
  service: 'bg-sky-50 text-sky-700 ring-sky-200',
  mot: 'bg-violet-50 text-violet-700 ring-violet-200',
  repair: 'bg-orange-50 text-orange-700 ring-orange-200',
  replacement: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  reading: 'bg-slate-100 text-slate-600 ring-slate-200',
}

/** A request to focus a history entry's row. `n` changes on every jump so repeats re-trigger. */
export type EntryFocus = { entryId: string; n: number }

export function HistoryTimeline({ vehicle, focus }: { vehicle: Vehicle; focus?: EntryFocus | null }) {
  const entries = getHistory(vehicle)
  const [editing, setEditing] = useState<HistoryEntry | null>(null)

  // Scroll a jumped-to entry into view and briefly highlight it (mirrors PartsList's zone focus).
  const rows = useRef(new Map<string, HTMLLIElement | null>())
  const [highlighted, setHighlighted] = useState<string | null>(null)
  useEffect(() => {
    if (!focus) return
    rows.current.get(focus.entryId)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    setHighlighted(focus.entryId)
    const timer = setTimeout(() => setHighlighted(null), 1500)
    return () => clearTimeout(timer)
  }, [focus])

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
            // Odometer readings are managed via "Update mileage", not edited here.
            const editable = entry.kind !== 'reading'
            const body = (
              <>
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
              </>
            )
            return (
              <li
                key={entry.id}
                ref={(el) => {
                  rows.current.set(entry.id, el)
                }}
                className={`transition-colors ${highlighted === entry.id ? 'bg-sky-50' : ''}`}
              >
                {editable ? (
                  <button
                    type="button"
                    onClick={() => setEditing(entry)}
                    className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-slate-50"
                  >
                    {body}
                  </button>
                ) : (
                  <div className="flex items-start gap-3 px-4 py-3">{body}</div>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {editing && (
        <HistoryEntryForm vehicle={vehicle} entry={editing} onClose={() => setEditing(null)} />
      )}
    </section>
  )
}
