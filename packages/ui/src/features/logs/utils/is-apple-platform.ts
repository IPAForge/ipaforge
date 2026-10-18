/** Whether the shortcut is ⌘L (macOS, iPadOS) rather than Ctrl+L; read when shown, never at import. */
export const isApplePlatform = (): boolean =>
  /Mac|iPhone|iPad/.test(globalThis.navigator?.platform ?? '')
