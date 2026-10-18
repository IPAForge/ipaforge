import type { ErrorCode } from '@ipaforge/kernel'
import type { BundleKind } from '@signer/domain/bundle/types.ts'

/** The device facts the check needs (lockdownd's `ProductVersion` and `DeviceClass`). */
export type TargetDevice = {
  readonly iosVersion: string
  /** `iPhone`, `iPad`, `iPod`; any other class is not checked. */
  readonly deviceClass?: string
}

/** Why the app cannot run on the device: what the app needs and what the device has. */
export type CompatibilityProblem =
  | {
      readonly code: typeof ErrorCode.UnsupportedIos
      readonly data: {
        readonly minimumOSVersion: string
        readonly iosVersion: string
      }
    }
  | {
      readonly code: typeof ErrorCode.UnsupportedDevice
      readonly data: {
        readonly deviceFamilies: readonly number[]
        readonly deviceClass: string
      }
    }
  | {
      readonly code: typeof ErrorCode.NoArm64Build
      readonly data: {
        readonly architectures: readonly string[]
        readonly supported: readonly string[]
      }
    }

export type Rule = (
  app: InspectedApp,
  device: TargetDevice
) => CompatibilityProblem | undefined

/** One App ID to register: the new bundle identifier and a display name. */
export type BundleIdentity = {
  readonly identifier: string
  readonly name: string
}

export type SideloadIdentityPlan = {
  /** `<original main ID>.<TEAMID>`. */
  readonly newMainBundleId: string
  /** Main app first, then every provisioned nested bundle. */
  readonly bundles: readonly BundleIdentity[]
  /** `group.<newMainBundleId>`, when the app declares any app group. */
  readonly appGroup?: string
  /** Every declared app group → `appGroup` (for `ReconcileOptions.appGroups`). */
  readonly appGroups: ReadonlyMap<string, string>
}

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
