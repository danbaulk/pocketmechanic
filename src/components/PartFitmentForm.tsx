import { useState } from 'react'
import type { FittedPart, Vehicle } from '../types.ts'
import type { CataloguePart } from '../data/partsCatalogue.ts'
import { useGarage } from '../garageContext.ts'
import { estimateCurrentMileage } from '../health.ts'
import { todayISO } from '../format.ts'
import { Modal, fieldClass, labelClass, primaryBtnClass } from './Modal.tsx'

type Props = {
  vehicle: Vehicle
  part: FittedPart
  cat: CataloguePart
  onClose: () => void
}

/** Set or edit a part's fit-date and fit-mileage. Editing resets the part's clock. */
export function PartFitmentForm({ vehicle, part, cat, onClose }: Props) {
  const { dispatch } = useGarage()
  const isEdit = part.fitDate !== null && part.fitMileage !== null
  const [date, setDate] = useState(part.fitDate ?? todayISO())
  const [mileage, setMileage] = useState(
    part.fitMileage !== null ? String(part.fitMileage) : String(estimateCurrentMileage(vehicle, new Date())),
  )

  const mileageNum = Number(mileage)
  const valid = date !== '' && Number.isFinite(mileageNum) && mileageNum >= 0

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!valid) return
    dispatch({ type: 'setPartFitment', vehicleId: vehicle.id, partId: part.id, fitDate: date, fitMileage: mileageNum })
    onClose()
  }

  return (
    <Modal title={`${isEdit ? 'Update' : 'Set'} ${cat.name.toLowerCase()}`} onClose={onClose}>
      <p className="mb-3 text-sm text-slate-500">
        When was this last fitted or replaced? This sets its wear clock from that point.
      </p>
      <form onSubmit={submit} className="space-y-3">
        <div>
          <label className={labelClass}>Date fitted</label>
          <input type="date" className={fieldClass} value={date} max={todayISO()} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>Mileage when fitted</label>
          <input className={fieldClass} value={mileage} onChange={(e) => setMileage(e.target.value)} inputMode="numeric" />
        </div>
        <button type="submit" disabled={!valid} className={primaryBtnClass}>
          {isEdit ? 'Save' : 'Set fitted'}
        </button>
      </form>
    </Modal>
  )
}
