import { describe, expect, it } from 'vitest'

import { createPreloadStore } from '@ui/state/preload/preload-store.ts'

const stik = {
  label: 'StikDebug',
  source: { kind: 'catalog' as const, appId: 'stikdebug' }
}
const game = {
  label: 'MyGame.ipa',
  size: 48,
  source: { kind: 'file' as const, path: '/Users/me/MyGame.ipa' }
}

describe('createPreloadStore', () => {
  it('adds apps once each, and removes and clears them', () => {
    const store = createPreloadStore()
    const seen: number[] = []
    store.subscribe(() => seen.push(store.getState().length))

    store.add([stik, game])
    store.add([{ ...game, label: 'again.ipa' }, stik])
    expect(store.getState().map((item) => item.label)).toEqual([
      'StikDebug',
      'MyGame.ipa'
    ])
    const [first] = store.getState()
    store.remove(first?.id ?? '')
    expect(store.getState().map((item) => item.label)).toEqual(['MyGame.ipa'])
    store.clear()
    expect(store.getState()).toEqual([])
    expect(seen).toEqual([2, 1, 0])
  })

  it('keeps a refused file by its name', () => {
    const store = createPreloadStore()
    store.add([{ label: 'notes.txt', refused: 'not-ipa' }])
    store.add([{ label: 'notes.txt', refused: 'not-ipa' }])
    expect(store.getState()).toHaveLength(1)
  })
})
