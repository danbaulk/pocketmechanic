import { useEffect, useReducer, type ReactNode } from 'react'
import { garageReducer } from './reducer.ts'
import { load, save } from './storage.ts'
import { GarageContext } from './garageContext.ts'

export function GarageProvider({ children }: { children: ReactNode }) {
  // Lazily seed the reducer from localStorage on first render.
  const [state, dispatch] = useReducer(garageReducer, undefined, load)

  // Persist on every change.
  useEffect(() => {
    save(state)
  }, [state])

  return <GarageContext value={{ state, dispatch }}>{children}</GarageContext>
}
