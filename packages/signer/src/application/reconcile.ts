import {
  ErrorCode,
  LoadstarError,
  type Logger,
  type PlistDict,
  serializeXmlPlist
} from '@loadstar/kernel'
import { embeddedEntitlements } from '@signer/application/embedded-entitlements.ts'
import { sideloadEntitlements } from '@signer/application/sideload-entitlements.ts'
import type {
  BundleProvisioning,
  ReconcileContext,
  ReconcileOptions,
  ReconcileResult,
  ReconcileTarget
} from '@signer/application/types.ts'
import {
  discoverBundles,
  isProvisioned
} from '@signer/domain/bundle/discover.ts'
import {
  altAppGroupsOf,
  rewriteInfoPlist,
  rewriteNestedId,
  withAltAppGroups
} from '@signer/domain/bundle/info-plist.ts'
import { INFO_PLIST } from '@signer/domain/bundle/layout.ts'
import {
  isWithin,
  joinPath,
  readFile,
  removePath,
  writeFile
} from '@signer/domain/bundle/tree.ts'
import type {
  BundleTree,
  CodeBundle,
  IdentityRewrite
} from '@signer/domain/bundle/types.ts'
import { resolveLimits } from '@signer/domain/config.ts'
import {
  describeProfile,
  type ProvisioningProfile,
  parseProvisioningProfile,
  profileContainsCertificate,
  profileCoversBundle
} from '@signer/infrastructure/profile/profile.ts'

const fail = (
  code: ErrorCode,
  message: string,
  data: Record<string, unknown>
): never => {
  throw new LoadstarError(code, { message, data })
}

const provisionsDevice = (
  profile: ProvisioningProfile,
  udid: string
): boolean =>
  profile.provisionsAllDevices ||
  profile.provisionedDevices.some(
    (candidate) => candidate.toLowerCase() === udid.toLowerCase()
  )

const validateProfile = (
  profile: ProvisioningProfile,
  bundleId: string,
  options: ReconcileOptions
): void => {
  const data = { bundleId, profile: describeProfile(profile) }
  if (profile.teamId !== options.teamId) {
    fail(
      ErrorCode.ProfileMismatch,
      `profile belongs to team ${profile.teamId}, not ${options.teamId}`,
      data
    )
  }
  if (!profileCoversBundle(profile, bundleId)) {
    fail(
      ErrorCode.ProfileMismatch,
      `profile is for ${profile.applicationIdentifier}, not ${bundleId}`,
      data
    )
  }
  if (profile.expirationDate.getTime() <= options.now.getTime()) {
    fail(ErrorCode.ProfileExpired, 'provisioning profile has expired', data)
  }
  if (!profileContainsCertificate(profile, options.certificate)) {
    fail(
      ErrorCode.CertificateNotInProfile,
      'signing certificate is not listed in the profile',
      data
    )
  }
  if (options.deviceUdid && !provisionsDevice(profile, options.deviceUdid)) {
    fail(
      ErrorCode.DeviceNotProvisioned,
      'the target device is not in the profile',
      data
    )
  }
}

/** The bundle's Info.plist with its identity rewritten; nested bundles also list the app's groups. */
const reconciledInfoPlist = (
  bundle: CodeBundle,
  target: ReconcileTarget
): PlistDict => {
  const info = rewriteInfoPlist(
    bundle.infoPlist,
    target.bundleId,
    target.rewrite
  )

  return bundle.path === '' ? info : withAltAppGroups(info, target.altAppGroups)
}

/** Validates the bundle's profile, rewrites its Info.plist and returns what it must be signed with. */
const reconcileBundle = (
  tree: BundleTree,
  bundle: CodeBundle,
  target: ReconcileTarget,
  context: ReconcileContext
): BundleProvisioning => {
  const { bundleId } = target
  const profile = parseProvisioningProfile(
    target.rawProfile,
    context.limits.plist
  )
  validateProfile(profile, bundleId, context.options)
  const original = embeddedEntitlements(
    readFile(tree, bundle.executable),
    context.limits
  )?.dict
  const entitlements = sideloadEntitlements(profile, original, {
    bundleId,
    logger: context.logger
  })

  writeFile(
    tree,
    joinPath(bundle.path, INFO_PLIST),
    serializeXmlPlist(reconciledInfoPlist(bundle, target))
  )
  return {
    entitlements: {
      bytes: serializeXmlPlist(entitlements),
      dict: entitlements
    },
    provisioningProfile: profile.raw,
    profile
  }
}

/** A nested bundle without a profile is removed when the caller allows it; anything else fails. */
const pruneUnprovisioned = (
  tree: BundleTree,
  bundle: CodeBundle,
  bundleId: string,
  context: ReconcileContext
): void => {
  if (bundle.path === '' || !context.options.pruneUnprovisioned) {
    fail(ErrorCode.ProfileMismatch, `no provisioning profile for ${bundleId}`, {
      bundleId,
      path: bundle.path
    })
  }
  removePath(tree, bundle.path)
  context.logger.warn('removed extension without a provisioning profile', {
    path: bundle.path,
    bundleId
  })
}

/**
 * Prepares an app for sideloading in place: new bundle IDs, rewritten Info.plists, and the
 * entitlements + profile each executable must be signed with (signer-spec §8).
 */
export const reconcileForSideload = (
  tree: BundleTree,
  options: ReconcileOptions,
  logger: Logger
): ReconcileResult => {
  const limits = resolveLimits(options.limits)
  const context: ReconcileContext = { options, limits, logger }
  const bundles = discoverBundles(tree, limits)
  const main = bundles.at(-1) as CodeBundle
  const rewrite: IdentityRewrite = {
    oldMainId: main.identifier,
    newMainId: options.newMainBundleId,
    appGroups: options.appGroups ?? new Map()
  }
  const altAppGroups = altAppGroupsOf(
    rewriteInfoPlist(main.infoPlist, options.newMainBundleId, rewrite)
  )

  const provisioning = new Map<string, BundleProvisioning>()
  const bundleIds = new Map<string, string>()
  const pruned: string[] = []

  // Main app first, so a failure on the app itself is reported before any extension.
  for (const bundle of [main, ...bundles.slice(0, -1)]) {
    if (!isProvisioned(bundle)) continue
    if (pruned.some((path) => isWithin(bundle.path, path))) continue

    const newId = rewriteNestedId(bundle.identifier, rewrite)
    const raw = options.profiles.get(newId)
    if (!raw) {
      pruneUnprovisioned(tree, bundle, newId, context)
      pruned.push(bundle.path)
      continue
    }

    const reconciled = reconcileBundle(
      tree,
      bundle,
      { bundleId: newId, rawProfile: raw, rewrite, altAppGroups },
      context
    )
    provisioning.set(bundle.path, reconciled)
    bundleIds.set(bundle.identifier, newId)
    logger.info('reconciled bundle', {
      path: bundle.path || '.',
      from: bundle.identifier,
      to: newId,
      profile: reconciled.profile.uuid
    })
  }

  return { provisioning, bundleIds, pruned }
}
