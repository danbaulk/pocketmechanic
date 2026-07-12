import { useState } from 'react'
import type { Vehicle } from '../types.ts'
import { useGarage } from '../garageContext.ts'
import { estimateCurrentMileage } from '../health.ts'
import { getCataloguePart } from '../data/partsCatalogue.ts'
import { todayISO } from '../format.ts'
import { Modal, fieldClass, labelClass, primaryBtnClass } from './Modal.tsx'

/**
 * Log a part replacement from the "+ Log" menu: pick one of the car's parts and record
 * when it was fitted. A part that already has a fit date is a genuine replacement, so it
 * logs a `replacement` history entry and resets the wear clock (`replacePart`); a
 * needs-info part just gets its first fit date recorded silently (`setPartFitment`).
 */
export function ReplacePartForm({ vehicle, onClose }: { vehicle: Vehicle; onClose: () => void }) {
  const { dispatch } = useGarage()

  // Sort the car's parts by catalogue name; flag the ones still awaiting a fit date.
  const options = vehicle.parts
    .map((p) => ({ part: p, name: getCataloguePart(p.catalogueId)?.name ?? p.catalogueId }))
    .sort((a, b) => a.name.localeCompare(b.name))

  const [partId, setPartId] = useState(options[0]?.part.id ?? '')
  const selected = vehicle.parts.find((p) => p.id === partId) ?? null
  const isReplacement = selected !== null && selected.fitDate !== null && selected.fitMileage !== null

  const [date, setDate] = useState(todayISO())
  const [mileage, setMileage] = useState(String(estimateCurrentMileage(vehicle, new Date())))
  const [note, setNote] = useState('')

  const mileageNum = Number(mileage)
  const valid = selected !== null && date !== '' && Number.isFinite(mileageNum) && mileageNum >= 0

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!valid || !selected) return
    if (isReplacement) {
      dispatch({ type: 'replacePart', vehicleId: vehicle.id, partId: selected.id, fitDate: date, fitMileage: mileageNum, note })
    } else {
      dispatch({ type: 'setPartFitment', vehicleId: vehicle.id, partId: selected.id, fitDate: date, fitMileage: mileageNum })
    }
    onClose()
  }

  return (
    <Modal title="Replace a part" onClose={onClose}>
      {options.length === 0 ? (
        <p className="text-sm text-slate-500">This car has no parts yet. Add some via Customise first.</p>
      ) : (
        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className={labelClass}>Part</label>
            <select className={fieldClass} value={partId} onChange={(e) => setPartId(e.target.value)}>
              {options.map(({ part, name }) => {
                const needsInfo = part.fitDate === null || part.fitMileage === null
                return (
                  <option key={part.id} value={part.id}>
                    {name}
                    {needsInfo ? ' - needs fit date' : ''}
                  </option>
                )
              })}
            </select>
          </div>
          <p className="text-sm text-slate-500">
            {isReplacement
              ? "Logs a replacement in the history and resets this part's wear clock from now."
              : 'When was this last fitted or replaced? This sets its wear clock from that point.'}
          </p>
          <div>
            <label className={labelClass}>Date fitted</label>
            <input type="date" className={fieldClass} value={date} max={todayISO()} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>Mileage when fitted</label>
            <input className={fieldClass} value={mileage} onChange={(e) => setMileage(e.target.value)} inputMode="numeric" />
          </div>
          {isReplacement && (
            <div>
              <label className={labelClass}>Note (optional)</label>
              <input
                className={fieldClass}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="e.g. fitted by Kwik Fit"
              />
            </div>
          )}
          <button type="submit" disabled={!valid} className={primaryBtnClass}>
            {isReplacement ? 'Log replacement' : 'Set fitted'}
          </button>
        </form>
      )}
    </Modal>
  )
}
