import { useState } from 'react'
import type { Vehicle } from '../types.ts'
import type { PartZone } from '../data/partsCatalogue.ts'
import type { PartWithHealth } from '../health.ts'
import { useGarage } from '../garageContext.ts'
import { CarAvatar } from './CarAvatar.tsx'
import { PartsList, type ZoneFocus } from './PartsList.tsx'
import { HistoryTimeline, type EntryFocus } from './HistoryTimeline.tsx'
import { PartDetailModal } from './PartDetailModal.tsx'

export function Dashboard({ vehicle }: { vehicle: Vehicle }) {
  const { dispatch } = useGarage()
  // The `n` counter re-triggers the scroll even when the same zone/entry is targeted twice.
  const [focus, setFocus] = useState<ZoneFocus | null>(null)
  const focusZone = (zone: PartZone) => setFocus((f) => ({ zone, n: (f?.n ?? 0) + 1 }))

  const [selectedPart, setSelectedPart] = useState<PartWithHealth | null>(null)
  const [entryFocus, setEntryFocus] = useState<EntryFocus | null>(null)
  const jumpToEntry = (entryId: string) => {
    setEntryFocus((f) => ({ entryId, n: (f?.n ?? 0) + 1 }))
    setSelectedPart(null)
  }

  function remove() {
    if (confirm(`Remove ${vehicle.make} ${vehicle.model} and its history?`)) {
      dispatch({ type: 'deleteVehicle', id: vehicle.id })
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">
            {vehicle.make} {vehicle.model}
          </h2>
          <p className="text-sm text-slate-500">
            {vehicle.year}
            {vehicle.reg ? ` · ${vehicle.reg}` : ''}
          </p>
        </div>
        <button
          type="button"
          onClick={remove}
          className="rounded-md px-2 py-1 text-xs text-slate-400 hover:bg-slate-100 hover:text-red-600"
        >
          Remove car
        </button>
      </div>
      <CarAvatar vehicle={vehicle} onZoneClick={focusZone} />
      <PartsList vehicle={vehicle} focus={focus} onSelectPart={setSelectedPart} />
      <HistoryTimeline vehicle={vehicle} focus={entryFocus} />
      {selectedPart && (
        <PartDetailModal
          item={selectedPart}
          vehicle={vehicle}
          onJumpToEntry={jumpToEntry}
          onClose={() => setSelectedPart(null)}
        />
      )}
    </div>
  )
}
