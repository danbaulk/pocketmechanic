import { useState } from 'react'
import type { Vehicle } from '../types.ts'
import { ReadingForm } from './ReadingForm.tsx'
import { HistoryEntryForm } from './HistoryEntryForm.tsx'

type Mode = null | 'reading' | 'log'

const btnClass = 'rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50'

/**
 * The record-keeping actions on the diagram card: "Update mileage" opens the odometer form
 * (`ReadingForm`) directly, and "+ Log" opens the service/MOT/repair form (`HistoryEntryForm`,
 * which carries its own kind toggle) directly.
 */
export function LogMenu({ vehicle }: { vehicle: Vehicle }) {
  const [mode, setMode] = useState<Mode>(null)
  const close = () => setMode(null)

  return (
    <>
      <button type="button" onClick={() => setMode('reading')} className={btnClass}>
        Update mileage
      </button>
      <button type="button" onClick={() => setMode('log')} className={btnClass}>
        + Log
      </button>

      {mode === 'reading' && <ReadingForm vehicle={vehicle} onClose={close} />}
      {mode === 'log' && <HistoryEntryForm vehicle={vehicle} onClose={close} />}
    </>
  )
}
