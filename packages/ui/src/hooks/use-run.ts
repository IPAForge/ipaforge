import { useContext, useSyncExternalStore } from 'react'

import { ActiveRunContext } from '@ui/state/active-run/active-run-context.ts'
import type {
  ActiveRun,
  ActiveRunStore
} from '@ui/state/active-run/active-run-store.ts'

export type UseRun = Omit<ActiveRunStore, 'getState' | 'subscribe'> & {
  /** The current or last install run; undefined before the first one and after Done. */
  readonly run: ActiveRun | undefined
}

/** The install run as view state (steps, overall progress, the waiting prompt, the outcome), and its actions. */
export const useRun = (): UseRun => {
  const store = useContext(ActiveRunContext)
  if (!store) throw new Error('useRun must be used inside <App>')
  const run = useSyncExternalStore(store.subscribe, store.getState)

  return {
    run,
    start: store.start,
    resume: store.resume,
    restart: store.restart,
    answer: store.answer,
    decline: store.decline,
    cancel: store.cancel,
    dismiss: store.dismiss
  }
}
