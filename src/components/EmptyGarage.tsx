import { useState } from 'react'
import { AddVehicleForm } from './AddVehicleForm.tsx'

export function EmptyGarage() {
  const [adding, setAdding] = useState(false)
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
      <div className="text-6xl">🚗</div>
      <h2 className="mt-4 text-xl font-semibold text-slate-900">No cars yet</h2>
      <p className="mt-1 max-w-xs text-slate-500">
        Add your car to start tracking how worn its parts are — green, amber or red at a glance.
      </p>
      <button
        type="button"
        onClick={() => setAdding(true)}
        className="mt-6 rounded-lg bg-sky-600 px-5 py-2.5 font-medium text-white shadow-sm hover:bg-sky-700"
      >
        + Add your car
      </button>
      {adding && <AddVehicleForm onClose={() => setAdding(false)} />}
    </div>
  )
}
