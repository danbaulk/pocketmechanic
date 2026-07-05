import { useState } from 'react'
import type { Vehicle } from '../types.ts'
import { getPartsByZone, type ZoneGroup } from '../health.ts'
import { RAG_STYLES } from '../rag.ts'
import { PartRow } from './PartRow.tsx'
import { AddPartForm } from './AddPartForm.tsx'

export function PartsList({ vehicle }: { vehicle: Vehicle }) {
  const [adding, setAdding] = useState(false)
  const zones = getPartsByZone(vehicle, new Date())

  const redCount = zones.reduce((n, z) => n + z.redCount, 0)
  const amberCount = zones.reduce((n, z) => n + z.amberCount, 0)

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-slate-900">Parts by area</h3>
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          + Add part
        </button>
      </div>

      {(redCount > 0 || amberCount > 0) && (
        <p className="text-sm text-slate-500">
          {redCount > 0 && <span className="font-medium text-red-600">{redCount} due now</span>}
          {redCount > 0 && amberCount > 0 && ' · '}
          {amberCount > 0 && <span className="font-medium text-amber-600">{amberCount} due soon</span>}
        </p>
      )}

      {zones.length === 0 ? (
        <p className="rounded-2xl bg-white p-4 text-sm text-slate-500 ring-1 ring-slate-200">
          No parts on this car yet. Add one to start tracking its health.
        </p>
      ) : (
        zones.map((zone) => <ZoneSection key={zone.zone} vehicle={vehicle} zone={zone} />)
      )}

      {adding && <AddPartForm vehicle={vehicle} onClose={() => setAdding(false)} />}
    </section>
  )
}

function ZoneSection({ vehicle, zone }: { vehicle: Vehicle; zone: ZoneGroup }) {
  const dot = zone.worstRag ? RAG_STYLES[zone.worstRag].dot : 'bg-slate-300'
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2 px-1">
        <span className={`h-2 w-2 rounded-full ${dot}`} aria-hidden />
        <h4 className="text-sm font-semibold text-slate-700">{zone.zone}</h4>
        <span className="text-xs text-slate-400">{zone.parts.length}</span>
      </div>
      <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
        {zone.parts.map((item) => (
          <PartRow key={item.part.id} vehicle={vehicle} item={item} />
        ))}
      </ul>
    </div>
  )
}
