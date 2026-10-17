import type {
  ColorScheme,
  ColorSchemeSource
} from '@ui/services/system/types.ts'

const DARK_QUERY = '(prefers-color-scheme: dark)'

const toScheme = (prefersDark: boolean): ColorScheme =>
  prefersDark ? 'dark' : 'light'

/** Reads `prefers-color-scheme`, which both the browser and the Electron renderer report from the OS. */
export const createMediaColorSchemeSource = (
  matchMedia: Window['matchMedia']
): ColorSchemeSource => {
  const query = matchMedia(DARK_QUERY)

  return {
    current: () => toScheme(query.matches),
    subscribe: (listener) => {
      const onChange = (event: MediaQueryListEvent) =>
        listener(toScheme(event.matches))
      query.addEventListener('change', onChange)
      return () => query.removeEventListener('change', onChange)
    }
  }
}

/** A fixed scheme for tests and hosts without a media query. */
export const createFixedColorSchemeSource = (
  scheme: ColorScheme
): ColorSchemeSource => ({
  current: () => scheme,
  subscribe: () => () => {}
})
