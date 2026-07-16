import { useState } from 'react'
import type { Vehicle } from '../types.ts'
import { useGarage } from '../garageContext.ts'
import { PART_CATALOGUE, ZONE_ORDER, type CataloguePart } from '../data/partsCatalogue.ts'
import { estimateCurrentMileage } from '../health.ts'
import { todayISO } from '../format.ts'
import { Modal, fieldClass, labelClass, primaryBtnClass } from './Modal.tsx'

/** A car's editable details, kept as strings while the form is open. */
type Details = { make: string; model: string; year: string; reg: string; avgAnnualMiles: string }

/** Draft state for one catalogue part: whether it's on the car and its (optional) fitment. */
type PartDraft = { on: boolean; known: boolean; date: string; mileage: string; existingPartId?: string }

function seedDetails(v: Vehicle): Details {
  return {
    make: v.make,
    model: v.model,
    year: String(v.year),
    reg: v.reg ?? '',
    avgAnnualMiles: String(v.avgAnnualMiles),
  }
}

function seedParts(v: Vehicle): Record<string, PartDraft> {
  const estimated = String(estimateCurrentMileage(v, new Date()))
  const draft: Record<string, PartDraft> = {}
  for (const cat of PART_CATALOGUE) {
    const fitted = v.parts.find((p) => p.catalogueId === cat.id)
    draft[cat.id] = fitted
      ? { on: true, known: fitted.fitDate !== null, date: fitted.fitDate ?? todayISO(), mileage: fitted.fitMileage !== null ? String(fitted.fitMileage) : estimated, existingPartId: fitted.id }
      : { on: false, known: true, date: todayISO(), mileage: estimated }
  }
  return draft
}

/**
 * The "Customise" entry point on the diagram card: one editor for the car's details
 * (make/model/year/reg/avg miles) and which parts are tracked. Reuses the existing
 * `updateVehicle`/`addPart`/`removePart` actions; fitment of parts already on the car is
 * edited from the parts list, not here.
 */
export function CustomiseCar({ vehicle }: { vehicle: Vehicle }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
      >
        Customise
      </button>
      {open && <CustomiseForm vehicle={vehicle} onClose={() => setOpen(false)} />}
    </>
  )
}

function CustomiseForm({ vehicle, onClose }: { vehicle: Vehicle; onClose: () => void }) {
  const { dispatch } = useGarage()
  const [details, setDetails] = useState<Details>(() => seedDetails(vehicle))
  const [parts, setParts] = useState<Record<string, PartDraft>>(() => seedParts(vehicle))

  const yearNum = Number(details.year)
  const avgNum = Number(details.avgAnnualMiles)
  const detailsValid =
    details.make.trim() !== '' &&
    details.model.trim() !== '' &&
    Number.isInteger(yearNum) &&
    yearNum > 1900 &&
    Number.isFinite(avgNum) &&
    avgNum >= 0
  // Every part being added with a "known" fitment needs a valid mileage.
  const partsValid = PART_CATALOGUE.every((cat) => {
    const d = parts[cat.id]
    if (!d.on || d.existingPartId || !d.known) return true
    const m = Number(d.mileage)
    return d.date !== '' && Number.isFinite(m) && m >= 0
  })
  const valid = detailsValid && partsValid

  function setPart(id: string, patch: Partial<PartDraft>) {
    setParts((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }))
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!valid) return

    const patch = {
      make: details.make.trim(),
      model: details.model.trim(),
      year: yearNum,
      reg: details.reg.trim() || undefined,
      avgAnnualMiles: avgNum,
    }
    dispatch({ type: 'updateVehicle', id: vehicle.id, patch })

    for (const cat of PART_CATALOGUE) {
      const d = parts[cat.id]
      const wasOn = Boolean(d.existingPartId)
      if (d.on && !wasOn) {
        const withFitment = d.known
        dispatch({
          type: 'addPart',
          vehicleId: vehicle.id,
          catalogueId: cat.id,
          fitDate: withFitment ? d.date : null,
          fitMileage: withFitment ? Number(d.mileage) : null,
        })
      } else if (!d.on && wasOn) {
        dispatch({ type: 'removePart', vehicleId: vehicle.id, partId: d.existingPartId! })
      }
    }
    onClose()
  }

  return (
    <Modal title="Customise car" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <div className="max-h-[70vh] space-y-5 overflow-y-auto">
          <CarDetailsFields details={details} onChange={(patch) => setDetails((d) => ({ ...d, ...patch }))} />

          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-slate-700">Parts</h3>
            {ZONE_ORDER.map((zone) => {
              const cats = PART_CATALOGUE.filter((c) => c.zone === zone)
              if (cats.length === 0) return null
              return (
                <div key={zone} className="space-y-1">
                  <h4 className="text-xs font-medium uppercase tracking-wide text-slate-400">{zone}</h4>
                  <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl ring-1 ring-slate-200">
                    {cats.map((cat) => (
                      <PartChecklistRow key={cat.id} cat={cat} draft={parts[cat.id]} onChange={(patch) => setPart(cat.id, patch)} />
                    ))}
                  </ul>
                </div>
              )
            })}
          </div>
        </div>

        <button type="submit" disabled={!valid} className={primaryBtnClass}>
          Save changes
        </button>
      </form>
    </Modal>
  )
}

function CarDetailsFields({ details, onChange }: { details: Details; onChange: (patch: Partial<Details>) => void }) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-slate-700">Car details</h3>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>Make</label>
          <input className={fieldClass} value={details.make} onChange={(e) => onChange({ make: e.target.value })} />
        </div>
        <div>
          <label className={labelClass}>Model</label>
          <input className={fieldClass} value={details.model} onChange={(e) => onChange({ model: e.target.value })} />
        </div>
        <div>
          <label className={labelClass}>Year</label>
          <input className={fieldClass} value={details.year} onChange={(e) => onChange({ year: e.target.value })} inputMode="numeric" />
        </div>
        <div>
          <label className={labelClass}>Reg (optional)</label>
          <input className={fieldClass} value={details.reg} onChange={(e) => onChange({ reg: e.target.value })} />
        </div>
        <div className="col-span-2">
          <label className={labelClass}>Average miles per year</label>
          <input className={fieldClass} value={details.avgAnnualMiles} onChange={(e) => onChange({ avgAnnualMiles: e.target.value })} inputMode="numeric" />
        </div>
      </div>
    </div>
  )
}

function PartChecklistRow({ cat, draft, onChange }: { cat: CataloguePart; draft: PartDraft; onChange: (patch: Partial<PartDraft>) => void }) {
  const isExisting = Boolean(draft.existingPartId)
  const isNewAdd = draft.on && !isExisting
  return (
    <li className="bg-white px-3 py-2.5">
      <label className="flex items-center gap-3">
        <input
          type="checkbox"
          checked={draft.on}
          onChange={(e) => onChange({ on: e.target.checked })}
          className="h-4 w-4 shrink-0 rounded border-slate-300"
        />
        <span className="flex-1 text-sm font-medium text-slate-900">{cat.name}</span>
      </label>

      {isNewAdd && (
        <div className="mt-2 space-y-2 pl-7">
          <label className="flex items-center gap-2 text-xs text-slate-600">
            <input
              type="checkbox"
              checked={draft.known}
              onChange={(e) => onChange({ known: e.target.checked })}
              className="h-3.5 w-3.5 rounded border-slate-300"
            />
            I know when it was last fitted
          </label>
          {draft.known ? (
            <div className="grid grid-cols-2 gap-2">
              <input type="date" className={fieldClass} value={draft.date} max={todayISO()} onChange={(e) => onChange({ date: e.target.value })} aria-label={`${cat.name} date fitted`} />
              <input className={fieldClass} value={draft.mileage} onChange={(e) => onChange({ mileage: e.target.value })} inputMode="numeric" aria-label={`${cat.name} mileage when fitted`} />
            </div>
          ) : (
            <p className="text-xs text-slate-400">Assumed fitted from new (0 miles).</p>
          )}
        </div>
      )}
    </li>
  )
}
