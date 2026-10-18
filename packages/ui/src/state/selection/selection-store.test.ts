import { describe, expect, it, vi } from 'vitest'

import { silentLogger } from '@ipaforge/kernel'
import { createMemoryPreferencesStore } from '@ui/services/preferences/preferences-store.ts'
import { selectionKeys } from '@ui/state/selection/constants.ts'
import { createSelectionStore } from '@ui/state/selection/selection-store.ts'

describe('createSelectionStore', () => {
  it('starts with what was saved, and with nothing when nothing was', () => {
    const saved = createSelectionStore(
      createMemoryPreferencesStore({ [selectionKeys.account]: 'a1' }),
      silentLogger
    )
    expect(saved.getState()).toEqual({ account: 'a1' })

    const empty = createSelectionStore(
      createMemoryPreferencesStore(),
      silentLogger
    )
    expect(empty.getState()).toEqual({})
  })

  it('keeps a choice, saves it and tells listeners once', () => {
    const preferences = createMemoryPreferencesStore()
    const store = createSelectionStore(preferences, silentLogger)
    const listener = vi.fn()
    store.subscribe(listener)

    store.select('account', 'a2')
    store.select('account', 'a2')

    expect(store.getState()).toEqual({ account: 'a2' })
    expect(preferences.read('selection.account')).toBe('a2')
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('stops telling a listener that unsubscribed', () => {
    const store = createSelectionStore(
      createMemoryPreferencesStore(),
      silentLogger
    )
    const listener = vi.fn()
    const unsubscribe = store.subscribe(listener)
    unsubscribe()
    store.select('account', 'a3')

    expect(listener).not.toHaveBeenCalled()
  })
})
