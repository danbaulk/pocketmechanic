import type { PartWithHealth } from '../health.ts'
import { RAG_STYLES } from '../rag.ts'
import { consumedPercent, dueText, formatCost } from '../format.ts'

export function PartRow({ item }: { item: PartWithHealth }) {
  const { cat, health } = item
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
    </li>
  )
}
