import { useState } from 'react'
import type { Vehicle } from '../types.ts'
import { useGarage } from '../garageContext.ts'
import { estimateCurrentMileage } from '../health.ts'
import { formatDate, formatMiles, todayISO } from '../format.ts'
import { Modal, fieldClass, labelClass, primaryBtnClass } from './Modal.tsx'

export function MileagePanel({ vehicle }: { vehicle: Vehicle }) {
  const [editing, setEditing] = useState(false)
  const estimated = estimateCurrentMileage(vehicle, new Date())

  return (
    <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm text-slate-500">Estimated mileage</div>
          <div className="text-2xl font-semibold tabular-nums text-slate-900">{formatMiles(estimated)}</div>
        </div>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Update reading
        </button>
      </div>
      <p className="mt-2 text-xs text-slate-400">
        Last actual reading {formatMiles(vehicle.lastReadingMiles)} on {formatDate(vehicle.lastReadingDate)} ·{' '}
        {vehicle.avgAnnualMiles.toLocaleString('en-GB')} mi/yr
      </p>
      {editing && <ReadingForm vehicle={vehicle} onClose={() => setEditing(false)} />}
    </section>
  )
}

function ReadingForm({ vehicle, onClose }: { vehicle: Vehicle; onClose: () => void }) {
  const { dispatch } = useGarage()
  const [miles, setMiles] = useState(String(estimateCurrentMileage(vehicle, new Date())))
  const [date, setDate] = useState(todayISO())

  const milesNum = Number(miles)
  const valid = Number.isFinite(milesNum) && milesNum >= 0 && date !== ''

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!valid) return
    dispatch({ type: 'recordReading', vehicleId: vehicle.id, miles: milesNum, date })
    onClose()
  }

  return (
    <Modal title="Update odometer reading" onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <div>
          <label className={labelClass}>Current mileage</label>
          <input className={fieldClass} value={miles} onChange={(e) => setMiles(e.target.value)} inputMode="numeric" autoFocus />
        </div>
        <div>
          <label className={labelClass}>Reading taken</label>
          <input type="date" className={fieldClass} value={date} max={todayISO()} onChange={(e) => setDate(e.target.value)} />
        </div>
        <button type="submit" disabled={!valid} className={primaryBtnClass}>
          Save reading
        </button>
      </form>
    </Modal>
  )
}
