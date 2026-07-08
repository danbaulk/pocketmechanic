import { useState } from 'react'
import type { Vehicle } from '../types.ts'
import { useGarage } from '../garageContext.ts'
import { vehicleWorstRag } from '../health.ts'
import { RAG_STYLES } from '../rag.ts'
import { AddVehicleForm } from './AddVehicleForm.tsx'

/**
 * Horizontal, scrollable list of the garage's cars with a worst-RAG dot each. Tapping a
 * chip makes that car active; the trailing chip adds a new one. Built entirely on the
 * existing `setActiveVehicle` / `addVehicle` reducer actions.
 */
export function GarageBar() {
  const { state, dispatch } = useGarage()
  const [adding, setAdding] = useState(false)

  return (
    <div className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-lg gap-2 overflow-x-auto px-4 py-2.5">
        {state.vehicles.map((vehicle) => (
          <CarChip
            key={vehicle.id}
            vehicle={vehicle}
            active={vehicle.id === state.activeVehicleId}
            onSelect={() => dispatch({ type: 'setActiveVehicle', id: vehicle.id })}
          />
        ))}
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="shrink-0 rounded-full border border-dashed border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-500 hover:bg-slate-50"
        >
          + Add
        </button>
      </div>
      {adding && <AddVehicleForm onClose={() => setAdding(false)} />}
    </div>
  )
}

function CarChip({
  vehicle,
  active,
  onSelect,
}: {
  vehicle: Vehicle
  active: boolean
  onSelect: () => void
}) {
  const rag = vehicleWorstRag(vehicle, new Date())
  const dot = rag ? RAG_STYLES[rag].dot : 'bg-slate-300'
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-current={active ? 'true' : undefined}
      className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
        active
          ? 'border-sky-500 bg-sky-50 text-sky-700'
          : 'border-slate-300 text-slate-600 hover:bg-slate-50'
      }`}
    >
      <span className={`h-2 w-2 rounded-full ${dot}`} aria-hidden />
      {vehicle.make} {vehicle.model}
    </button>
  )
}
