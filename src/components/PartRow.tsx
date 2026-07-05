import { useState } from 'react'
import type { Vehicle } from '../types.ts'
import type { PartWithHealth } from '../health.ts'
import { useGarage } from '../garageContext.ts'
import { RAG_STYLES } from '../rag.ts'
import { consumedPercent, dueText, formatCost } from '../format.ts'
import { PartFitmentForm } from './PartFitmentForm.tsx'

export function PartRow({ vehicle, item }: { vehicle: Vehicle; item: PartWithHealth }) {
  const { dispatch } = useGarage()
  const [editing, setEditing] = useState(false)
  const { part, cat, health } = item
  const styles = RAG_STYLES[health.rag]
  const pct = consumedPercent(health)

  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${health.known ? styles.dot : 'bg-slate-300'}`} aria-hidden />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className="truncate font-medium text-slate-900">{cat.name}</span>
          <span className="shrink-0 text-xs text-slate-400">{formatCost(cat.costLow, cat.costHigh)}</span>
        </div>
        <div className="mt-0.5 flex items-center justify-between gap-2 text-sm">
          <span className={health.rag === 'red' ? 'text-red-600' : 'text-slate-500'}>{dueText(health)}</span>
          {health.known && <span className="text-xs tabular-nums text-slate-400">{pct}% used</span>}
        </div>
        {health.known && (
          <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
            <div className={`h-full ${styles.dot}`} style={{ width: `${Math.min(100, pct)}%` }} />
          </div>
        )}
      </div>
      <div className="flex shrink-0 flex-col gap-1">
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="rounded-md px-2 py-1 text-xs font-medium text-sky-600 hover:bg-sky-50"
        >
          {health.known ? 'Replaced' : 'Set fitted'}
        </button>
        <button
          type="button"
          onClick={() => dispatch({ type: 'removePart', vehicleId: vehicle.id, partId: part.id })}
          className="rounded-md px-2 py-1 text-xs text-slate-400 hover:bg-slate-100 hover:text-slate-600"
        >
          Remove
        </button>
      </div>
      {editing && <PartFitmentForm vehicle={vehicle} part={part} cat={cat} onClose={() => setEditing(false)} />}
    </li>
  )
}
