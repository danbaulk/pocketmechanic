import type { RAG } from './types.ts'

/**
 * Tailwind class bundles for the RAG signal, mirroring the sibling apps' token use.
 * `fill` is for SVG regions (the Phase 2 car avatar); `dot`/`badge` are for `<div>`s.
 */
export const RAG_STYLES: Record<RAG, { dot: string; fill: string; badge: string; label: string }> = {
  green: {
    dot: 'bg-emerald-500',
    fill: 'fill-emerald-500',
    badge: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    label: 'Healthy',
  },
  amber: {
    dot: 'bg-amber-500',
    fill: 'fill-amber-500',
    badge: 'bg-amber-50 text-amber-700 ring-amber-200',
    label: 'Due soon',
  },
  red: {
    dot: 'bg-red-500',
    fill: 'fill-red-500',
    badge: 'bg-red-50 text-red-700 ring-red-200',
    label: 'Due now',
  },
}

/** Fill class for a zone/vehicle whose RAG is unknown (no parts with recorded fitment). */
export const UNKNOWN_FILL = 'fill-slate-300'
