import { useEffect, useRef, useState } from 'react'
import type { Vehicle } from '../types.ts'
import type { PartZone } from '../data/partsCatalogue.ts'
import { getPartsByZone, type ZoneGroup } from '../health.ts'
import { RAG_STYLES } from '../rag.ts'
import { PartRow } from './PartRow.tsx'

/** A request to focus a zone's section. `n` changes on every tap so repeats re-trigger. */
export type ZoneFocus = { zone: PartZone; n: number }

export function PartsList({ vehicle, focus }: { vehicle: Vehicle; focus?: ZoneFocus | null }) {
  const zones = getPartsByZone(vehicle, new Date())

  const redCount = zones.reduce((n, z) => n + z.redCount, 0)
  const amberCount = zones.reduce((n, z) => n + z.amberCount, 0)

  // Scroll the tapped zone's section into view and briefly highlight it.
  const sections = useRef(new Map<PartZone, HTMLDivElement | null>())
  const [highlighted, setHighlighted] = useState<PartZone | null>(null)
  useEffect(() => {
    if (!focus) return
    sections.current.get(focus.zone)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    setHighlighted(focus.zone)
    const timer = setTimeout(() => setHighlighted(null), 1500)
    return () => clearTimeout(timer)
  }, [focus])

  return (
    <section className="space-y-4">
      <h3 className="font-semibold text-slate-900">Parts by area</h3>

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
        zones.map((zone) => (
          <ZoneSection
            key={zone.zone}
            zone={zone}
            highlighted={highlighted === zone.zone}
            innerRef={(el) => sections.current.set(zone.zone, el)}
          />
        ))
      )}
    </section>
  )
}

function ZoneSection({
  zone,
  highlighted,
  innerRef,
}: {
  zone: ZoneGroup
  highlighted: boolean
  innerRef: (el: HTMLDivElement | null) => void
}) {
  const dot = zone.worstRag ? RAG_STYLES[zone.worstRag].dot : 'bg-slate-300'
  return (
    <div
      ref={innerRef}
      className={`space-y-1.5 rounded-2xl transition-shadow ${
        highlighted ? 'ring-2 ring-sky-400 ring-offset-2' : ''
      }`}
    >
      <div className="flex items-center gap-2 px-1">
        <span className={`h-2 w-2 rounded-full ${dot}`} aria-hidden />
        <h4 className="text-sm font-semibold text-slate-700">{zone.zone}</h4>
        <span className="text-xs text-slate-400">{zone.parts.length}</span>
      </div>
      <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
        {zone.parts.map((item) => (
          <PartRow key={item.part.id} item={item} />
        ))}
      </ul>
    </div>
  )
}
