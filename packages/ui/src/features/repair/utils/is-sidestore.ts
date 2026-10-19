const SIDESTORE_BUNDLE_ID = 'com.SideStore.SideStore'

/** SideStore as installed: its own bundle id, or sideloaded as `<id>.<TEAMID>`. */
export const isSideStore = (bundleId: string): boolean =>
  bundleId === SIDESTORE_BUNDLE_ID ||
  bundleId.startsWith(`${SIDESTORE_BUNDLE_ID}.`)
