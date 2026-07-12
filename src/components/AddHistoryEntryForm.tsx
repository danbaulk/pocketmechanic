import { useState } from 'react'
import type { Vehicle } from '../types.ts'
import { useGarage } from '../garageContext.ts'
import { estimateCurrentMileage } from '../health.ts'
import { HISTORY_KIND_META } from '../history.ts'
import { todayISO } from '../format.ts'
import { Modal, fieldClass, labelClass, primaryBtnClass } from './Modal.tsx'

export type EntryKind = 'service' | 'mot' | 'repair'
const KINDS: EntryKind[] = ['service', 'mot', 'repair']

/** Log a service, MOT or repair against a vehicle. Dispatches `addHistoryEntry`. */
export function AddHistoryEntryForm({
  vehicle,
  onClose,
  initialKind = 'service',
}: {
  vehicle: Vehicle
  onClose: () => void
  initialKind?: EntryKind
}) {
  const { dispatch } = useGarage()
  const [kind, setKind] = useState<EntryKind>(initialKind)
  const [date, setDate] = useState(todayISO())
  const [mileage, setMileage] = useState(String(estimateCurrentMileage(vehicle, new Date())))
  const [note, setNote] = useState('')
  const [motResult, setMotResult] = useState<'pass' | 'fail'>('pass')

  const mileageNum = Number(mileage)
  const mileageValid = mileage.trim() === '' || (Number.isFinite(mileageNum) && mileageNum >= 0)
  const valid = date !== '' && mileageValid

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!valid) return
    dispatch({
      type: 'addHistoryEntry',
      vehicleId: vehicle.id,
      kind,
      date,
      mileage: mileage.trim() === '' ? null : mileageNum,
      note,
      ...(kind === 'mot' ? { motResult } : {}),
    })
    onClose()
  }

  return (
    <Modal title="Add history entry" onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <div>
          <label className={labelClass}>Type</label>
          <div className="grid grid-cols-3 gap-2">
            {KINDS.map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setKind(k)}
                className={`rounded-lg border px-3 py-2 text-sm font-medium ${
                  kind === k
                    ? 'border-sky-500 bg-sky-50 text-sky-700'
                    : 'border-slate-300 text-slate-600 hover:bg-slate-50'
                }`}
              >
                {HISTORY_KIND_META[k].label}
              </button>
            ))}
          </div>
          <p className="mt-1 text-xs text-slate-400">{HISTORY_KIND_META[kind].description}</p>
        </div>

        {kind === 'mot' && (
          <div>
            <label className={labelClass}>Result</label>
            <div className="grid grid-cols-2 gap-2">
              {(['pass', 'fail'] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setMotResult(r)}
                  className={`rounded-lg border px-3 py-2 text-sm font-medium capitalize ${
                    motResult === r
                      ? r === 'pass'
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                        : 'border-red-500 bg-red-50 text-red-700'
                      : 'border-slate-300 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>
        )}

        <div>
          <label className={labelClass}>Date</label>
          <input type="date" className={fieldClass} value={date} max={todayISO()} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>Mileage (optional)</label>
          <input className={fieldClass} value={mileage} onChange={(e) => setMileage(e.target.value)} inputMode="numeric" />
        </div>
        <div>
          <label className={labelClass}>Note (optional)</label>
          <input
            className={fieldClass}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={kind === 'mot' ? 'e.g. advisory: front tyres wearing' : 'e.g. full service at 60k'}
          />
        </div>
        <button type="submit" disabled={!valid} className={primaryBtnClass}>
          Add entry
        </button>
      </form>
    </Modal>
  )
}
