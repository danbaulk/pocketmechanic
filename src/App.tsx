import { useGarage } from './garageContext.ts'
import { EmptyGarage } from './components/EmptyGarage.tsx'
import { GarageBar } from './components/GarageBar.tsx'
import { Dashboard } from './components/Dashboard.tsx'

export function App() {
  const { state } = useGarage()
  const active =
    state.vehicles.find((v) => v.id === state.activeVehicleId) ?? state.vehicles[0] ?? null

  return (
    <div className="flex min-h-full flex-col bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-lg items-center gap-2 px-4 py-3">
          <span className="text-xl">🔧</span>
          <h1 className="text-lg font-semibold text-slate-900">PocketMechanic</h1>
        </div>
      </header>
      {state.vehicles.length > 0 && <GarageBar />}
      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col px-4 py-5">
        {active ? <Dashboard vehicle={active} /> : <EmptyGarage />}
      </main>
    </div>
  )
}
