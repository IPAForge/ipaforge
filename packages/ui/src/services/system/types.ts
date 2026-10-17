export type ColorScheme = 'light' | 'dark'

/** The operating system's light/dark preference, followed when the colour mode is `system`. */
export type ColorSchemeSource = {
  current: () => ColorScheme
  /** Calls `listener` whenever the OS preference changes; returns the unsubscribe function. */
  subscribe: (listener: (scheme: ColorScheme) => void) => () => void
}
