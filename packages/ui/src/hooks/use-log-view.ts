import { useContext, useSyncExternalStore } from 'react'

import { LogViewContext } from '@ui/state/log-view/log-view-context.ts'
import type { LogViewState, LogViewStore } from '@ui/state/log-view/types.ts'

export type UseLogView = Omit<LogViewStore, 'getState' | 'subscribe'> & {
  readonly view: LogViewState
}

/** The log viewer's filters, kept by `App` so they stay between visits to Logs. */
export const useLogView = (): UseLogView => {
  const store = useContext(LogViewContext)
  if (!store) throw new Error('useLogView must be used inside <App>')
  const { getState, subscribe, ...actions } = store

  return { view: useSyncExternalStore(subscribe, getState), ...actions }
}
