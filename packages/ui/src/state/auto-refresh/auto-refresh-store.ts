import type { PreferencesStore } from '@ui/services/preferences/preferences-store.ts'
import {
  AUTO_REFRESH_DAYS,
  AutoRefreshKey,
  DEFAULT_AUTO_REFRESH
} from '@ui/state/auto-refresh/constants.ts'
import type {
  AutoRefreshSettings,
  AutoRefreshStore
} from '@ui/state/auto-refresh/types.ts'

const readDays = (saved: string | undefined): number => {
  const days = Number(saved)

  return (AUTO_REFRESH_DAYS as readonly number[]).includes(days)
    ? days
    : DEFAULT_AUTO_REFRESH.daysBefore
}

/** The automatic-refresh settings, saved with the other UI preferences. */
export const createAutoRefreshStore = (
  preferences: PreferencesStore
): AutoRefreshStore => {
  const listeners = new Set<() => void>()
  let state: AutoRefreshSettings = {
    isOn: preferences.read(AutoRefreshKey.isOn) !== 'false',
    daysBefore: readDays(preferences.read(AutoRefreshKey.daysBefore))
  }

  return {
    getState: () => state,
    subscribe: (listener) => {
      listeners.add(listener)

      return () => {
        listeners.delete(listener)
      }
    },
    set: (settings) => {
      state = { ...state, ...settings }
      preferences.write(AutoRefreshKey.isOn, String(state.isOn))
      preferences.write(AutoRefreshKey.daysBefore, String(state.daysBefore))
      for (const listener of [...listeners]) listener()
    }
  }
}
