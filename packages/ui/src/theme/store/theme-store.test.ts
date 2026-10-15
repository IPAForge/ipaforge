import { describe, expect, it, vi } from 'vitest'

import { createTestServices } from '@ui/__tests__/test-services.tsx'
import { ThemePreferenceKey } from '@ui/theme/store/theme-config.ts'
import { createThemeStore } from '@ui/theme/store/theme-store.ts'

const setup = (saved: Readonly<Record<string, string>> = {}) => {
  const { services, records, scheme } = createTestServices({
    preferences: saved
  })
  const store = createThemeStore({
    preferences: services.preferences,
    system: scheme.source,
    logger: services.logger
  })

  return { store, records, scheme, preferences: services.preferences }
}

describe('createThemeStore', () => {
  it('starts with Graphite following the system scheme', () => {
    const { store } = setup()
    expect(store.getState()).toEqual({
      palette: 'graphite',
      mode: 'system',
      scheme: 'light'
    })
  })

  it('restores saved preferences and ignores unknown values', () => {
    expect(
      setup({
        [ThemePreferenceKey.Palette]: 'forest',
        [ThemePreferenceKey.Mode]: 'dark'
      }).store.getState()
    ).toEqual({ palette: 'forest', mode: 'dark', scheme: 'dark' })
    expect(
      setup({
        [ThemePreferenceKey.Palette]: 'neon',
        [ThemePreferenceKey.Mode]: 'dim'
      }).store.getState()
    ).toEqual({
      palette: 'graphite',
      mode: 'system',
      scheme: 'light'
    })
  })

  it('persists palette and mode changes and notifies subscribers', () => {
    const { store, preferences } = setup()
    const listener = vi.fn()
    store.subscribe(listener)

    store.setPalette('sunset')
    store.setMode('dark')

    expect(preferences.read(ThemePreferenceKey.Palette)).toBe('sunset')
    expect(preferences.read(ThemePreferenceKey.Mode)).toBe('dark')
    expect(store.getState()).toEqual({
      palette: 'sunset',
      mode: 'dark',
      scheme: 'dark'
    })
    expect(listener).toHaveBeenCalledTimes(2)
  })

  it('does not notify when nothing changes', () => {
    const { store } = setup()
    const listener = vi.fn()
    store.subscribe(listener)
    store.setPalette('graphite')
    store.setMode('system')
    expect(listener).not.toHaveBeenCalled()
  })

  it('follows the OS scheme only in system mode, until stopped', () => {
    const { store, scheme } = setup()
    const stop = store.followSystem()

    scheme.change('dark')
    expect(store.getState().scheme).toBe('dark')

    store.setMode('light')
    scheme.change('light')
    scheme.change('dark')
    expect(store.getState().scheme).toBe('light')

    store.setMode('system')
    expect(store.getState().scheme).toBe('dark')

    stop()
    expect(scheme.listenerCount()).toBe(0)
  })

  it('picks up an OS change that happened before it started following', () => {
    const { store, scheme } = setup()
    scheme.change('dark')
    store.followSystem()
    expect(store.getState().scheme).toBe('dark')
  })

  it('logs changes at debug under the theme scope', () => {
    const { store, records } = setup()
    store.setPalette('rose')
    store.setMode('light')
    expect(
      records.map(({ level, scope, msg, fields }) => ({
        level,
        scope,
        msg,
        fields
      }))
    ).toEqual([
      {
        level: 'debug',
        scope: 'theme',
        msg: 'palette changed',
        fields: { palette: 'rose' }
      },
      {
        level: 'debug',
        scope: 'theme',
        msg: 'colour mode changed',
        fields: { mode: 'light', scheme: 'light' }
      }
    ])
  })
})
