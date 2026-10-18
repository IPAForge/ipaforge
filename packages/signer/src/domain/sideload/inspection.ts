// What an IPA declares about its identity, read before any Apple call.
import { compact, type PlistDict, stringAt } from '@ipaforge/kernel'
import {
  CF_BUNDLE_DISPLAY_NAME,
  CF_BUNDLE_NAME,
  CF_BUNDLE_SHORT_VERSION,
  MINIMUM_OS_VERSION
} from '@signer/domain/bundle/info-keys.ts'
import { altAppGroupsOf } from '@signer/domain/bundle/info-plist.ts'
import { baseName } from '@signer/domain/bundle/tree.ts'
import type { CodeBundle } from '@signer/domain/bundle/types.ts'
import { stringsOf } from '@signer/domain/dict.ts'
import {
  APPLICATION_GROUPS,
  KEYCHAIN_ACCESS_GROUPS
} from '@signer/domain/entitlements/names.ts'
import { deviceFamiliesOf } from '@signer/domain/sideload/device-families.ts'
import type {
  InspectedApp,
  InspectedBundle,
  IpaInspection,
  NestedBundleKind
} from '@signer/domain/sideload/types.ts'

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
