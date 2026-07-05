import type { RAG } from './types.ts'

/** Tailwind class bundles for the RAG signal, mirroring the sibling apps' token use. */
export const RAG_STYLES: Record<RAG, { dot: string; badge: string; label: string }> = {
  green: {
    dot: 'bg-emerald-500',
    badge: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    label: 'Healthy',
  },
  amber: {
    dot: 'bg-amber-500',
    badge: 'bg-amber-50 text-amber-700 ring-amber-200',
    label: 'Due soon',
  },
  red: {
    dot: 'bg-red-500',
    badge: 'bg-red-50 text-red-700 ring-red-200',
    label: 'Due now',
  },
}
