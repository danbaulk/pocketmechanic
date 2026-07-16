import { useState } from 'react'
import type { Vehicle } from '../types.ts'
import { ReadingForm } from './ReadingForm.tsx'
import { HistoryEntryForm } from './HistoryEntryForm.tsx'
import { secondaryBtnClass } from './Modal.tsx'

type Mode = null | 'reading' | 'log'

/**
 * The record-keeping actions on the diagram card: "Update mileage" opens the odometer form
 * (`ReadingForm`) directly, and "Log" opens the service/MOT/repair form (`HistoryEntryForm`,
 * which carries its own kind toggle) directly.
 */
export function LogMenu({ vehicle }: { vehicle: Vehicle }) {
  const [mode, setMode] = useState<Mode>(null)
  const close = () => setMode(null)

  return (
    <>
      <button type="button" onClick={() => setMode('reading')} className={secondaryBtnClass}>
        Update mileage
      </button>
      <button type="button" onClick={() => setMode('log')} className={secondaryBtnClass}>
        Log
      </button>

      {mode === 'reading' && <ReadingForm vehicle={vehicle} onClose={close} />}
      {mode === 'log' && <HistoryEntryForm vehicle={vehicle} onClose={close} />}
    </>
  )
}
