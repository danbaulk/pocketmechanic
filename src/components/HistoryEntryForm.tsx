import { useState } from 'react'
import type { HistoryEntry, Vehicle } from '../types.ts'
import { useGarage } from '../garageContext.ts'
import type { JobKind } from '../reducer.ts'
import { estimateCurrentMileage } from '../health.ts'
import { HISTORY_KIND_META, minLoggableMileage } from '../history.ts'
import { getCataloguePart } from '../data/partsCatalogue.ts'
import { formatMiles, todayISO } from '../format.ts'
import { Modal, fieldClass, labelClass, primaryBtnClass } from './Modal.tsx'

const KINDS: JobKind[] = ['service', 'mot', 'repair', 'inspection']

/**
 * The job kind an entry edits as. Legacy 'replacement' entries edit as a repair (the closest
 * of the job kinds); every current kind must map to itself, or editing an entry would quietly
 * rewrite it - turning an inspection into a repair and re-flagging the parts it vouched for.
 */
function toEntryKind(kind: HistoryEntry['kind']): JobKind {
  return kind === 'replacement' || kind === 'reading' ? 'repair' : kind
}

/**
 * Log or edit a service, MOT, repair or inspection against a vehicle, including the parts it
 * replaced (each ticked part's wear clock resets to this entry's date/mileage) and the parts it
 * checked and passed (each ticked part's life is extended). Given an `entry` it edits in place
 * (`updateHistoryEntry`) and offers deletion; otherwise it adds a new entry.
 */
export function HistoryEntryForm({
  vehicle,
  onClose,
  entry,
}: {
  vehicle: Vehicle
  onClose: () => void
  entry?: HistoryEntry
}) {
  const { dispatch } = useGarage()
  const editing = entry !== undefined

  const [kind, setKind] = useState<JobKind>(entry ? toEntryKind(entry.kind) : 'service')
  const [date, setDate] = useState(entry ? entry.date : todayISO())
  const [mileage, setMileage] = useState(
    entry ? (entry.mileage === null ? '' : String(entry.mileage)) : String(estimateCurrentMileage(vehicle, new Date())),
  )
  const [note, setNote] = useState(entry?.note ?? '')
  const [motResult, setMotResult] = useState<'pass' | 'fail'>(entry?.motResult ?? 'pass')
  const [partIds, setPartIds] = useState<Set<string>>(
    () => new Set(entry?.partRefs?.map((r) => r.partId) ?? []),
  )
  const [checkedIds, setCheckedIds] = useState<Set<string>>(
    () => new Set(entry?.checkedRefs?.map((r) => r.partId) ?? []),
  )

  // The car's parts, sorted by catalogue name, for the two checklists.
  const partOptions = vehicle.parts
    .map((p) => ({ id: p.id, name: getCataloguePart(p.catalogueId)?.name ?? p.catalogueId }))
    .sort((a, b) => a.name.localeCompare(b.name))

  const toggleIn = (setter: typeof setPartIds) => (id: string) =>
    setter((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  const togglePart = toggleIn(setPartIds)
  const toggleChecked = toggleIn(setCheckedIds)

  // An inspection replaces nothing, so its "replaced" list is hidden - and any ticks made
  // before switching kind are dropped rather than submitted invisibly.
  const replaces = kind !== 'inspection'
  const submittedPartIds = replaces ? [...partIds] : []

  const mileageNum = Number(mileage)
  const mileageEmpty = mileage.trim() === ''
  // An odometer never goes backwards: an entry can't undercut a mileage already logged by its
  // date. When editing, the entry itself is excluded so it doesn't constrain its own value.
  const min = minLoggableMileage(vehicle.history, date, entry?.id)
  const tooLow = !mileageEmpty && Number.isFinite(mileageNum) && mileageNum < min
  const mileageValid = mileageEmpty || (Number.isFinite(mileageNum) && mileageNum >= min)
  // A replaced part needs a mileage to anchor its wear clock, and a checked one to measure its
  // extension from - both are ignored without one - so a mileage becomes required.
  const mileageRequired = submittedPartIds.length > 0 || checkedIds.size > 0
  const valid = date !== '' && mileageValid && !(mileageRequired && mileageEmpty)

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!valid) return
    const fields = {
      vehicleId: vehicle.id,
      kind,
      date,
      mileage: mileageEmpty ? null : mileageNum,
      note,
      partIds: submittedPartIds,
      checkedPartIds: [...checkedIds],
      ...(kind === 'mot' ? { motResult } : {}),
    }
    if (editing) dispatch({ type: 'updateHistoryEntry', entryId: entry.id, ...fields })
    else dispatch({ type: 'addHistoryEntry', ...fields })
    onClose()
  }

  function remove() {
    if (!entry) return
    dispatch({ type: 'removeHistoryEntry', vehicleId: vehicle.id, entryId: entry.id })
    onClose()
  }

  return (
    <Modal title={editing ? 'Edit entry' : 'Add history entry'} onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <div>
          <label className={labelClass}>Type</label>
          <div className="grid grid-cols-2 gap-2">
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
          <label className={labelClass}>Mileage{mileageRequired ? '' : ' (optional)'}</label>
          <input className={fieldClass} value={mileage} onChange={(e) => setMileage(e.target.value)} inputMode="numeric" />
          {tooLow && (
            <p className="mt-1 text-xs text-red-600">Can't be below {formatMiles(min)} - already logged by this date.</p>
          )}
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

        {partOptions.length > 0 && replaces && (
          <PartChecklist
            label="Parts replaced (optional)"
            hint="Resets each ticked part's wear clock to this date and mileage."
            options={partOptions}
            ticked={partIds}
            onToggle={togglePart}
          />
        )}

        {partOptions.length > 0 && (
          <PartChecklist
            label={replaces ? 'Parts checked and OK (optional)' : 'Parts checked and OK'}
            hint="Gives each ticked part a bit more life instead of resetting its wear clock, since it wasn't replaced."
            options={partOptions}
            ticked={checkedIds}
            onToggle={toggleChecked}
            // A part being replaced can't also be "still fine" - the new one hasn't been checked.
            disabled={partIds}
          />
        )}

        <button type="submit" disabled={!valid} className={primaryBtnClass}>
          {editing ? 'Save changes' : 'Add entry'}
        </button>
        {editing && (
          <button
            type="button"
            onClick={remove}
            className="w-full rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
          >
            Delete entry
          </button>
        )}
      </form>
    </Modal>
  )
}

/** A tickable list of the car's parts. `disabled` ticks off-limits here (already ticked elsewhere). */
function PartChecklist({
  label,
  hint,
  options,
  ticked,
  onToggle,
  disabled,
}: {
  label: string
  hint: string
  options: { id: string; name: string }[]
  ticked: Set<string>
  onToggle: (id: string) => void
  disabled?: Set<string>
}) {
  return (
    <div>
      <label className={labelClass}>{label}</label>
      <p className="mb-1.5 text-xs text-slate-400">{hint}</p>
      <ul className="max-h-40 space-y-1 overflow-y-auto rounded-lg border border-slate-200 p-2">
        {options.map((p) => {
          const off = disabled?.has(p.id) ?? false
          return (
            <li key={p.id}>
              <label className={`flex items-center gap-2 text-sm ${off ? 'text-slate-300' : 'text-slate-700'}`}>
                <input
                  type="checkbox"
                  checked={ticked.has(p.id) && !off}
                  disabled={off}
                  onChange={() => onToggle(p.id)}
                  className="h-4 w-4 rounded border-slate-300"
                />
                {p.name}
              </label>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
