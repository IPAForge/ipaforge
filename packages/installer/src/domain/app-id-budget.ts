// The App ID budget for everything a run installs, checked before any App ID is created.
import type { AppIdPlan } from '@ipaforge/apple'
import { compact, ErrorCode, IPAForgeError } from '@ipaforge/kernel'
import type { SideloadIdentityPlan } from '@ipaforge/signer'

/** Every bundle identifier the plans need an App ID for (main apps and their extensions), once each. */
export const plannedIdentifiers = (
  plans: readonly SideloadIdentityPlan[]
): string[] => [
  ...new Set(
    plans.flatMap((plan) => plan.bundles.map((bundle) => bundle.identifier))
  )
]

/**
 * `apple.app_id_quota` with how many are needed and when the next slot frees up, unless the plan fits, or Apple's
 * count was negative (`unreliable`) and the user asked to try anyway.
 */
export const assertAppIdBudget = (plan: AppIdPlan, tryAnyway = false): void => {
  if (plan.enough || (tryAnyway && plan.isUnreliable)) return
  throw new IPAForgeError(ErrorCode.AppIdQuotaExceeded, {
    data: compact({
      needed: plan.create.length,
      available: plan.available,
      nextSlotAt: plan.nextSlotAt?.toISOString(),
      unreliable: plan.isUnreliable
    })
  })
}
