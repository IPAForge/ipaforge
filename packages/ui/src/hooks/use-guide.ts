import { useContext, useSyncExternalStore } from 'react'

import { GuideContext } from '@ui/state/guide/guide-context.ts'
import type { GuideState, GuideStore } from '@ui/state/guide/types.ts'

/** The setup guide's progress and how to move through it. */
export const useGuide = (): Omit<GuideStore, 'getState' | 'subscribe'> & {
  readonly guide: GuideState
} => {
  const store = useContext(GuideContext)
  if (!store) throw new Error('useGuide must be used inside <App>')
  const { getState, subscribe, ...actions } = store

  return { guide: useSyncExternalStore(subscribe, getState), ...actions }
}
