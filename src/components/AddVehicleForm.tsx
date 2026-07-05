import { useState } from 'react'
import { useGarage } from '../garageContext.ts'
import { todayISO } from '../format.ts'
import { Modal, fieldClass, labelClass, primaryBtnClass } from './Modal.tsx'

export function AddVehicleForm({ onClose }: { onClose: () => void }) {
  const { dispatch } = useGarage()
  const [make, setMake] = useState('')
  const [model, setModel] = useState('')
  const [year, setYear] = useState('')
  const [reg, setReg] = useState('')
  const [mileage, setMileage] = useState('')
  const [avgAnnual, setAvgAnnual] = useState('7000')

  const yearNum = Number(year)
  const mileageNum = Number(mileage)
  const avgNum = Number(avgAnnual)
  const valid =
    make.trim() !== '' &&
    model.trim() !== '' &&
    Number.isFinite(yearNum) &&
    yearNum > 1900 &&
    Number.isFinite(mileageNum) &&
    mileageNum >= 0 &&
    Number.isFinite(avgNum) &&
    avgNum >= 0

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!valid) return
    dispatch({
      type: 'addVehicle',
      vehicle: {
        make,
        model,
        year: yearNum,
        reg: reg.trim() || undefined,
        currentMileage: mileageNum,
        currentDate: todayISO(),
        avgAnnualMiles: avgNum,
      },
    })
    onClose()
  }

  return (
    <Modal title="Add your car" onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>Make</label>
            <input className={fieldClass} value={make} onChange={(e) => setMake(e.target.value)} placeholder="Ford" autoFocus />
          </div>
          <div>
            <label className={labelClass}>Model</label>
            <input className={fieldClass} value={model} onChange={(e) => setModel(e.target.value)} placeholder="Focus" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>Year</label>
            <input className={fieldClass} value={year} onChange={(e) => setYear(e.target.value)} inputMode="numeric" placeholder="2018" />
          </div>
          <div>
            <label className={labelClass}>Reg (optional)</label>
            <input className={fieldClass} value={reg} onChange={(e) => setReg(e.target.value.toUpperCase())} placeholder="AB18 CDE" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>Current mileage</label>
            <input className={fieldClass} value={mileage} onChange={(e) => setMileage(e.target.value)} inputMode="numeric" placeholder="54200" />
          </div>
          <div>
            <label className={labelClass}>Avg miles / year</label>
            <input className={fieldClass} value={avgAnnual} onChange={(e) => setAvgAnnual(e.target.value)} inputMode="numeric" />
          </div>
        </div>
        <button type="submit" disabled={!valid} className={primaryBtnClass}>
          Add car
        </button>
      </form>
    </Modal>
  )
}
