import type { Vehicle } from '../types.ts'
import { useGarage } from '../garageContext.ts'
import { MileagePanel } from './MileagePanel.tsx'
import { PartsList } from './PartsList.tsx'

export function Dashboard({ vehicle }: { vehicle: Vehicle }) {
  const { dispatch } = useGarage()

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
      <MileagePanel vehicle={vehicle} />
      <PartsList vehicle={vehicle} />
    </div>
  )
}
