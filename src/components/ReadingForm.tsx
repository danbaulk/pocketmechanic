import { useState } from 'react'
import type { Vehicle } from '../types.ts'
import { useGarage } from '../garageContext.ts'
import { estimateCurrentMileage } from '../health.ts'
import { todayISO } from '../format.ts'
import { Modal, fieldClass, labelClass, primaryBtnClass } from './Modal.tsx'

/** Record an actual odometer reading, re-anchoring the mileage estimate. Dispatches `recordReading`. */
export function ReadingForm({ vehicle, onClose }: { vehicle: Vehicle; onClose: () => void }) {
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
