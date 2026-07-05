import { useState } from 'react'
import type { Vehicle } from '../types.ts'
import { useGarage } from '../garageContext.ts'
import { PART_CATALOGUE } from '../data/partsCatalogue.ts'
import { estimateCurrentMileage } from '../health.ts'
import { todayISO } from '../format.ts'
import { Modal, fieldClass, labelClass, primaryBtnClass } from './Modal.tsx'

export function AddPartForm({ vehicle, onClose }: { vehicle: Vehicle; onClose: () => void }) {
  const { dispatch } = useGarage()
  const fittedIds = new Set(vehicle.parts.map((p) => p.catalogueId))
  const available = PART_CATALOGUE.filter((c) => !fittedIds.has(c.id))

  const [catalogueId, setCatalogueId] = useState(available[0]?.id ?? '')
  const [known, setKnown] = useState(true)
  const [date, setDate] = useState(todayISO())
  const [mileage, setMileage] = useState(String(estimateCurrentMileage(vehicle, new Date())))

  const mileageNum = Number(mileage)
  const valid =
    catalogueId !== '' && (!known || (date !== '' && Number.isFinite(mileageNum) && mileageNum >= 0))

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!valid) return
    dispatch({
      type: 'addPart',
      vehicleId: vehicle.id,
      catalogueId,
      fitDate: known ? date : null,
      fitMileage: known ? mileageNum : null,
    })
    onClose()
  }

  return (
    <Modal title="Add a part" onClose={onClose}>
      {available.length === 0 ? (
        <p className="text-sm text-slate-500">Every catalogue part is already on this car.</p>
      ) : (
        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className={labelClass}>Part</label>
            <select className={fieldClass} value={catalogueId} onChange={(e) => setCatalogueId(e.target.value)}>
              {available.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={known} onChange={(e) => setKnown(e.target.checked)} className="h-4 w-4 rounded border-slate-300" />
            I know when it was last fitted
          </label>
          {known && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Date fitted</label>
                <input type="date" className={fieldClass} value={date} max={todayISO()} onChange={(e) => setDate(e.target.value)} />
              </div>
              <div>
                <label className={labelClass}>Mileage</label>
                <input className={fieldClass} value={mileage} onChange={(e) => setMileage(e.target.value)} inputMode="numeric" />
              </div>
            </div>
          )}
          <button type="submit" disabled={!valid} className={primaryBtnClass}>
            Add part
          </button>
        </form>
      )}
    </Modal>
  )
}
