// What the user picked in the top bar, kept through PreferencesStore so it survives a restart: the Apple ID and the
// device in use.
import type { Logger } from '@ipaforge/kernel'
import type { PreferencesStore } from '@ui/services/preferences/preferences-store.ts'
import { selectionKeys } from '@ui/state/selection/constants.ts'
import type { Selection, SelectionStore } from '@ui/state/selection/types.ts'

const readSelection = (preferences: PreferencesStore): Selection =>
  Object.fromEntries(
    Object.entries(selectionKeys).flatMap(([kind, key]) => {
      const id = preferences.read(key)

      return id ? [[kind, id]] : []
    })
  )

export const createSelectionStore = (
  preferences: PreferencesStore,
  logger: Logger
): SelectionStore => {
  const log = logger.child({ scope: 'selection' })
  const listeners = new Set<() => void>()
  let state = readSelection(preferences)

  return {
    getState: () => state,
    subscribe: (listener) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    select: (kind, id) => {
      if (state[kind] === id) return
      state = { ...state, [kind]: id }
      preferences.write(selectionKeys[kind], id)
      log.debug('selection changed', { kind })
      for (const listener of [...listeners]) listener()
    }
  }
}
