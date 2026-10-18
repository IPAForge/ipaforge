import { useContext, useSyncExternalStore } from 'react'

import { PreloadContext } from '@ui/state/preload/preload-context.ts'
import type { PreloadItem, PreloadStore } from '@ui/state/preload/types.ts'

export type UsePreloadList = Omit<PreloadStore, 'getState' | 'subscribe'> & {
  readonly items: readonly PreloadItem[]
}

/** The Preload page's list, kept by `App` so it stays while the user visits other sections. */
export const usePreloadList = (): UsePreloadList => {
  const store = useContext(PreloadContext)
  if (!store) throw new Error('usePreloadList must be used inside <App>')
  const { getState, subscribe, ...actions } = store

  return { items: useSyncExternalStore(subscribe, getState), ...actions }
}
