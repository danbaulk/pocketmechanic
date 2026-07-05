import { createContext, useContext, type Dispatch } from 'react'
import type { AppState } from './types.ts'
import type { Action } from './reducer.ts'

export type GarageContextValue = { state: AppState; dispatch: Dispatch<Action> }

export const GarageContext = createContext<GarageContextValue | null>(null)

export function useGarage(): GarageContextValue {
  const ctx = useContext(GarageContext)
  if (!ctx) throw new Error('useGarage must be used within a GarageProvider')
  return ctx
}
