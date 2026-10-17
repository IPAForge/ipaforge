import {
  LIVECONTAINER_BUNDLE_ID,
  SIDESTORE_BUNDLE_ID
} from '@installer/sidestore/constants.ts'

export const SIGNED_PREFIX = 'signed'

export const PERCENT = 100

/** Main apps that can hold a SideStore target; any other app is never read a second time. */
export const CANDIDATES: ReadonlySet<string> = new Set([
  SIDESTORE_BUNDLE_ID,
  LIVECONTAINER_BUNDLE_ID
])
