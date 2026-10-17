import type { BundleKind } from '@signer/domain/bundle/types.ts'
import {
  MH_BUNDLE,
  MH_DYLIB,
  MH_EXECUTE
} from '@signer/domain/macho/constants.ts'

/** Nested bundle kind by directory suffix (a nested `.app` is a watch app). */
export const BUNDLE_SUFFIXES: readonly [string, BundleKind][] = [
  ['.appex', 'appex'],
  ['.framework', 'framework'],
  ['.app', 'watch-app'],
  ['.xctest', 'xctest']
]

/** Bundles that need their own App ID and provisioning profile. */
export const PROVISIONED_KINDS = new Set<BundleKind>([
  'app',
  'appex',
  'watch-app'
])

/** Mach-O file types that are signed. */
export const SIGNABLE_FILETYPES = new Set([MH_EXECUTE, MH_DYLIB, MH_BUNDLE])
