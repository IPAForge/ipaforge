import { useContext, useSyncExternalStore } from 'react'

import { AutoRefreshContext } from '@ui/state/auto-refresh/auto-refresh-context.ts'

/** The automatic-refresh settings and how to change them. */
export const useAutoRefreshSettings = () => {
  const store = useContext(AutoRefreshContext)

  if (!store)
    throw new Error('useAutoRefreshSettings must be used inside <App>')

  return {
    settings: useSyncExternalStore(store.subscribe, store.getState),
    set: store.set
  }
}
