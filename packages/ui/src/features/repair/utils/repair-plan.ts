import { daysLeft } from '@ui/features/apps/utils/expiry.ts'
import { isNewerVersion } from '@ui/features/apps/utils/is-newer-version.ts'
import { EXPIRES_SOON_DAYS } from '@ui/features/repair/constants.ts'
import type { Fix, RepairPlan, RepairStage } from '@ui/features/repair/types.ts'
import type {
  SideStoreCheck,
  SideStoreHealth
} from '@ui/services/engine/types.ts'
import type { RepairOptions } from '@ui/state/active-run/types.ts'

const isOutdated = (health: SideStoreHealth): boolean =>
  health.latest !== undefined &&
  health.version !== undefined &&
  isNewerVersion(health.latest, health.version)

const isExpiring = (health: SideStoreHealth, now: Date): boolean => {
  const days = daysLeft(health.expiresAt, now)

  return days !== undefined && days <= EXPIRES_SOON_DAYS
}

/** Installing SideStore again also gives it a profile, a certificate and the pairing file: it covers the rest. */
const withoutCovered = (fixes: readonly Fix[]): Fix[] =>
  fixes.includes('reinstall') ? ['reinstall'] : [...fixes]

/**
 * What Repair runs for the checks. Needed: installing SideStore again when its signing certificate was revoked or
 * it holds none; a new profile when it expired or is about to; the pairing file when it's missing. Offered: installing
 * it again when the signing certificate can't be told, the one it holds may have been replaced, or it's out of
 * date; replacing another computer's pairing file. Signed by another team or Apple ID, it can't be installed again
 * (nor get a profile) with this one: a second SideStore would appear, without its data.
 */
export const repairPlan = (health: SideStoreHealth, now: Date): RepairPlan => {
  const needsReinstall =
    health.signing === 'revoked' || health.ownCertificate === 'missing'
  const required = withoutCovered([
    ...(needsReinstall ? (['reinstall'] as const) : []),
    ...(isExpiring(health, now) ? (['profile'] as const) : []),
    ...(health.pairing === 'missing' ? (['pairing'] as const) : [])
  ])
  const offersReinstall =
    !required.includes('reinstall') &&
    (health.signing === 'unknown' ||
      health.ownCertificate === 'other' ||
      isOutdated(health))
  const offersPairing =
    !required.includes('reinstall') && health.pairing === 'other-computer'
  const optional: Fix[] = [
    ...(offersReinstall ? (['reinstall'] as const) : []),
    ...(offersPairing ? (['pairing'] as const) : [])
  ]
  const isOtherSigner = health.signedBy !== 'team'
  const allowed = (fix: Fix) => !isOtherSigner || fix === 'pairing'

  return {
    required: required.filter(allowed),
    optional: optional.filter(allowed),
    // Only when it kept a fix from running: a sound SideStore from another team needs nothing.
    blocked: [...required, ...optional].some((fix) => !allowed(fix))
  }
}

/** Where the check leaves things: SideStore missing, the device first, nothing to do, or a plan to run. */
export const repairStage = (
  check: SideStoreCheck,
  plan: RepairPlan | undefined
): RepairStage => {
  if (check.locked || check.developerMode === 'off') return 'device'
  if (!check.sideStore) return 'not-installed'
  if (
    !plan ||
    (!plan.blocked && plan.required.length + plan.optional.length === 0)
  )
    return 'fine'

  return 'plan'
}

/** The run's options: the needed fixes plus the offered ones picked, installing again covering the rest. */
export const repairOptions = (
  bundleId: string,
  plan: RepairPlan,
  picked: readonly Fix[]
): RepairOptions => {
  const fixes = withoutCovered([
    ...plan.required,
    ...plan.optional.filter((fix) => picked.includes(fix))
  ])

  return {
    bundleId,
    reinstall: fixes.includes('reinstall'),
    profile: fixes.includes('profile'),
    pairing: fixes.includes('pairing')
  }
}
