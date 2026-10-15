// What an IPA declares about its identity, read before any Apple call.
import { compact, type PlistDict, stringAt } from '@loadstar/kernel'
import type { BundleKind, CodeBundle } from '@signer/domain/bundle/discover.ts'
import {
  CF_BUNDLE_DISPLAY_NAME,
  CF_BUNDLE_NAME,
  CF_BUNDLE_SHORT_VERSION,
  MINIMUM_OS_VERSION
} from '@signer/domain/bundle/info-keys.ts'
import { altAppGroupsOf } from '@signer/domain/bundle/info-plist.ts'
import { baseName } from '@signer/domain/bundle/tree.ts'
import { stringsOf } from '@signer/domain/dict.ts'
import {
  APPLICATION_GROUPS,
  KEYCHAIN_ACCESS_GROUPS
} from '@signer/domain/entitlements/names.ts'
import { deviceFamiliesOf } from '@signer/domain/sideload/device-families.ts'

export type NestedBundleKind = Extract<BundleKind, 'appex' | 'watch-app'>

export type InspectedApp = {
  /** Archive path of the app, e.g. `Payload/SideStore.app`. */
  readonly path: string
  /** The original bundle identifier. */
  readonly identifier: string
  readonly name: string
  /** `CFBundleShortVersionString`. */
  readonly version?: string
  readonly minimumOSVersion?: string
  /** `UIDeviceFamily` (1 iPhone and iPod touch, 2 iPad); Apple's default, iPhone only, when absent. */
  readonly deviceFamilies: readonly number[]
  /** The main executable's slices, as `lipo` names them (`arm64`, `arm64e`, `armv7`, …); none if unreadable. */
  readonly architectures: readonly string[]
}

/** An extension or watch app: it needs its own App ID and profile. */
export type InspectedBundle = {
  /** Path relative to the main app (the key `ReconcileResult.provisioning` uses). */
  readonly path: string
  readonly kind: NestedBundleKind
  /** The original bundle identifier. */
  readonly identifier: string
  readonly name: string
}

export type IpaInspection = {
  readonly app: InspectedApp
  /** Every provisioned nested bundle, by path. */
  readonly nested: readonly InspectedBundle[]
  /** App groups the main executable's entitlements declare. */
  readonly appGroups: readonly string[]
  /** Keychain access groups the main executable's entitlements declare. */
  readonly keychainAccessGroups: readonly string[]
  /** `ALTAppGroups` in the main app's Info.plist. */
  readonly altAppGroups: readonly string[]
}

/** What the user sees: display name, else bundle name, else the executable's name. */
const bundleName = (bundle: CodeBundle): string =>
  stringAt(bundle.infoPlist, CF_BUNDLE_DISPLAY_NAME) ??
  stringAt(bundle.infoPlist, CF_BUNDLE_NAME) ??
  baseName(bundle.executable)

export const isNestedProvisioned = (
  bundle: CodeBundle
): bundle is CodeBundle & { readonly kind: NestedBundleKind } =>
  bundle.kind === 'appex' || bundle.kind === 'watch-app'

export const inspectedApp = (
  bundle: CodeBundle,
  path: string,
  architectures: readonly string[]
): InspectedApp =>
  compact({
    path,
    identifier: bundle.identifier,
    name: bundleName(bundle),
    version: stringAt(bundle.infoPlist, CF_BUNDLE_SHORT_VERSION),
    minimumOSVersion: stringAt(bundle.infoPlist, MINIMUM_OS_VERSION),
    deviceFamilies: deviceFamiliesOf(bundle.infoPlist),
    architectures
  })

export const inspectedBundle = (
  bundle: CodeBundle & { readonly kind: NestedBundleKind }
): InspectedBundle => ({
  path: bundle.path,
  kind: bundle.kind,
  identifier: bundle.identifier,
  name: bundleName(bundle)
})

/** The groups the main app declares, in its entitlements and its Info.plist. */
export const declaredGroups = (
  main: CodeBundle,
  entitlements: PlistDict | undefined
): Pick<
  IpaInspection,
  'appGroups' | 'keychainAccessGroups' | 'altAppGroups'
> => ({
  appGroups: stringsOf(entitlements?.[APPLICATION_GROUPS]),
  keychainAccessGroups: stringsOf(entitlements?.[KEYCHAIN_ACCESS_GROUPS]),
  altAppGroups: altAppGroupsOf(main.infoPlist)
})
