import type { ReactNode } from 'react'
import type { RAG, Vehicle } from '../types.ts'
import { estimateCurrentMileage, getPartsByZone } from '../health.ts'
import type { PartZone } from '../data/partsCatalogue.ts'
import { RAG_STYLES, UNKNOWN_FILL } from '../rag.ts'
import { formatDate, formatMiles } from '../format.ts'
import { LogMenu } from './LogMenu.tsx'
import { CustomiseCar } from './CustomiseCar.tsx'

/**
 * A schematic side-profile of the car with each of the 5 physical zones coloured by its
 * worst RAG. Tapping a zone bubbles up so the dashboard can jump to that zone's parts.
 * Zone colours come from the same engine (`getPartsByZone`) that drives the "Parts by area" list.
 */
export function CarAvatar({
  vehicle,
  onZoneClick,
}: {
  vehicle: Vehicle
  onZoneClick: (zone: PartZone) => void
}) {
  const ragByZone = new Map<PartZone, RAG | null>(
    getPartsByZone(vehicle, new Date()).map((z) => [z.zone, z.worstRag]),
  )
  const ragOf = (zone: PartZone): RAG | null => ragByZone.get(zone) ?? null
  const fillOf = (zone: PartZone): string => {
    const rag = ragOf(zone)
    return rag ? RAG_STYLES[rag].fill : UNKNOWN_FILL
  }

  const estimated = estimateCurrentMileage(vehicle, new Date())

  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <div className="text-sm text-slate-500">Estimated mileage</div>
          <div className="text-2xl font-semibold tabular-nums text-slate-900">{formatMiles(estimated)}</div>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <CustomiseCar vehicle={vehicle} />
          <LogMenu vehicle={vehicle} />
        </div>
      </div>

      <svg
        viewBox="0 0 320 150"
        className="mx-auto block h-auto w-full max-w-sm"
        role="group"
        aria-label="Car health by area - tap an area to see its parts"
      >
        {/* Neutral car silhouette (roof/cabin/doors carry no health zone). */}
        <path
          d="M24 112 L24 88 Q24 84 28 83 L112 80 L146 50 L210 50 L244 82 L296 86 Q300 86 300 90 L300 112 Z"
          className="fill-slate-100 stroke-slate-300"
          strokeWidth={2}
        />

        {/* Underside - chassis strip along the bottom, behind the wheels. */}
        <ZoneRegion zone="Underside" rag={ragOf('Underside')} onZoneClick={onZoneClick}>
          <rect x={88} y={108} width={158} height={14} rx={6} className={fillOf('Underside')} />
        </ZoneRegion>

        {/* Engine bay - the bonnet/front block. */}
        <ZoneRegion zone="Engine bay" rag={ragOf('Engine bay')} onZoneClick={onZoneClick}>
          <path
            d="M24 112 L24 88 Q24 84 28 83 L112 80 L112 112 Z"
            className={`${fillOf('Engine bay')} stroke-white`}
            strokeWidth={1.5}
          />
        </ZoneRegion>

        {/* Windscreen - the raked front glass. */}
        <ZoneRegion zone="Windscreen" rag={ragOf('Windscreen')} onZoneClick={onZoneClick}>
          <path
            d="M114 79 L146 51 L170 51 L136 79 Z"
            className={`${fillOf('Windscreen')} stroke-white`}
            strokeWidth={1.5}
          />
        </ZoneRegion>

        {/* Front wheel. */}
        <ZoneRegion zone="Front wheels" rag={ragOf('Front wheels')} onZoneClick={onZoneClick}>
          <circle cx={74} cy={112} r={20} className={`${fillOf('Front wheels')} stroke-white`} strokeWidth={2} />
          <circle cx={74} cy={112} r={8} className="fill-slate-100" />
        </ZoneRegion>

        {/* Rear wheel. */}
        <ZoneRegion zone="Rear wheels" rag={ragOf('Rear wheels')} onZoneClick={onZoneClick}>
          <circle cx={248} cy={112} r={20} className={`${fillOf('Rear wheels')} stroke-white`} strokeWidth={2} />
          <circle cx={248} cy={112} r={8} className="fill-slate-100" />
        </ZoneRegion>
      </svg>

      <Legend />

      <p className="mt-3 text-center text-xs text-slate-400">
        Last actual reading {formatMiles(vehicle.lastReadingMiles)} on {formatDate(vehicle.lastReadingDate)} ·{' '}
        {vehicle.avgAnnualMiles.toLocaleString('en-GB')} mi/yr
      </p>
    </div>
  )
}

/** A clickable, keyboard-focusable car area. `children` are the SVG shapes to colour. */
function ZoneRegion({
  zone,
  rag,
  onZoneClick,
  children,
}: {
  zone: PartZone
  rag: RAG | null
  onZoneClick: (zone: PartZone) => void
  children: ReactNode
}) {
  const status = rag ? RAG_STYLES[rag].label : 'No parts tracked'
  return (
    <g
      role="button"
      tabIndex={0}
      aria-label={`${zone} - ${status}`}
      onClick={() => onZoneClick(zone)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onZoneClick(zone)
        }
      }}
      className="cursor-pointer outline-none transition-opacity hover:opacity-75 focus-visible:opacity-75"
    >
      {children}
    </g>
  )
}

function Legend() {
  const items: RAG[] = ['green', 'amber', 'red']
  return (
    <ul className="mt-3 flex items-center justify-center gap-4">
      {items.map((rag) => (
        <li key={rag} className="flex items-center gap-1.5 text-xs text-slate-500">
          <span className={`h-2 w-2 rounded-full ${RAG_STYLES[rag].dot}`} aria-hidden />
          {RAG_STYLES[rag].label}
        </li>
      ))}
    </ul>
  )
}
