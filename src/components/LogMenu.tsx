import { useState } from 'react'
import type { Vehicle } from '../types.ts'
import { HISTORY_KIND_META } from '../history.ts'
import { Modal } from './Modal.tsx'
import { ReadingForm } from './ReadingForm.tsx'
import { ReplacePartForm } from './ReplacePartForm.tsx'
import { AddHistoryEntryForm, type EntryKind } from './AddHistoryEntryForm.tsx'

type Mode = null | 'menu' | 'reading' | 'replacement' | EntryKind

const CHOICES: { mode: Exclude<Mode, null | 'menu'>; label: string; hint: string }[] = [
  { mode: 'reading', label: 'Update mileage', hint: 'Record an actual odometer reading' },
  { mode: 'service', label: 'Log service', hint: HISTORY_KIND_META.service.description },
  { mode: 'mot', label: 'Log MOT', hint: HISTORY_KIND_META.mot.description },
  { mode: 'repair', label: 'Log repair', hint: HISTORY_KIND_META.repair.description },
  { mode: 'replacement', label: 'Replace a part', hint: "Log a replacement and reset that part's wear clock" },
]

/**
 * The single "+ Log" entry point on the diagram card. Opens a chooser sheet, then the
 * relevant form: an odometer reading (`ReadingForm`) or a history entry (`AddHistoryEntryForm`).
 */
export function LogMenu({ vehicle }: { vehicle: Vehicle }) {
  const [mode, setMode] = useState<Mode>(null)
  const close = () => setMode(null)

  return (
    <>
      <button
        type="button"
        onClick={() => setMode('menu')}
        className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
      >
        + Log
      </button>

      {mode === 'menu' && (
        <Modal title="Add to record" onClose={close}>
          <div className="space-y-2">
            {CHOICES.map((c) => (
              <button
                key={c.mode}
                type="button"
                onClick={() => setMode(c.mode)}
                className="w-full rounded-lg border border-slate-300 px-4 py-3 text-left hover:bg-slate-50"
              >
                <div className="font-medium text-slate-900">{c.label}</div>
                <div className="text-xs text-slate-400">{c.hint}</div>
              </button>
            ))}
          </div>
        </Modal>
      )}

      {mode === 'reading' && <ReadingForm vehicle={vehicle} onClose={close} />}
      {mode === 'replacement' && <ReplacePartForm vehicle={vehicle} onClose={close} />}
      {(mode === 'service' || mode === 'mot' || mode === 'repair') && (
        <AddHistoryEntryForm vehicle={vehicle} initialKind={mode} onClose={close} />
      )}
    </>
  )
}
