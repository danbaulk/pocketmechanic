import type { Vehicle } from '../types.ts'
import { entryDetail, getHistory, HISTORY_KIND_META } from '../history.ts'
import { estimateCurrentMileage } from '../health.ts'
import { formatDate, formatMiles } from '../format.ts'

/**
 * A print-only service record for the active vehicle: identity, estimated mileage and the
 * full history as a table. Hidden on screen (`hidden print:block`); the rest of the app is
 * `print:hidden`, so the browser's print / "Save as PDF" produces a clean resale record.
 */
export function PrintableHistory({ vehicle }: { vehicle: Vehicle }) {
  const entries = getHistory(vehicle)
  const estimated = estimateCurrentMileage(vehicle, new Date())

  return (
    <div className="hidden p-8 text-slate-900 print:block">
      <h1 className="text-2xl font-bold">
        {vehicle.make} {vehicle.model}
      </h1>
      <p className="mt-1 text-sm text-slate-600">
        {vehicle.year}
        {vehicle.reg ? ` · ${vehicle.reg}` : ''} · Estimated mileage {formatMiles(estimated)}
      </p>
      <p className="mt-0.5 text-xs text-slate-500">Service record generated {formatDate(new Date().toISOString())}</p>

      <h2 className="mt-6 mb-2 text-lg font-semibold">History</h2>
      {entries.length === 0 ? (
        <p className="text-sm text-slate-600">No history recorded.</p>
      ) : (
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-400 text-left">
              <th className="py-1 pr-4 font-semibold">Date</th>
              <th className="py-1 pr-4 font-semibold">Type</th>
              <th className="py-1 pr-4 font-semibold">Mileage</th>
              <th className="py-1 font-semibold">Details</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr key={entry.id} className="border-b border-slate-200 align-top">
                <td className="py-1 pr-4 whitespace-nowrap">{formatDate(entry.date)}</td>
                <td className="py-1 pr-4 whitespace-nowrap">{HISTORY_KIND_META[entry.kind].label}</td>
                <td className="py-1 pr-4 whitespace-nowrap tabular-nums">
                  {entry.mileage !== null ? formatMiles(entry.mileage) : '-'}
                </td>
                <td className="py-1">{entryDetail(entry) ?? '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
