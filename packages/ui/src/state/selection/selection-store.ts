// What the user picked in the top bar, kept through PreferencesStore so it survives a restart: the Apple ID and the
// device in use.
import type { Logger } from '@loadstar/kernel'
import type { PreferencesStore } from '@ui/services/preferences/preferences-store.ts'

/** The preference each choice is kept under. */
export const selectionKeys = {
  account: 'selection.account',
  device: 'selection.device'
} as const

export type SelectionKind = keyof typeof selectionKeys

/** The id picked for each kind (an account id, a device's UDID); missing until something is picked. */
export type Selection = Readonly<Partial<Record<SelectionKind, string>>>

export type SelectionStore = {
  getState: () => Selection
  subscribe: (listener: () => void) => () => void
  select: (kind: SelectionKind, id: string) => void
}

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
