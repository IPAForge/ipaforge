// The App ID budget for everything a run installs, checked before any App ID is created.
import type { AppIdPlan } from '@loadstar/apple'
import { compact, ErrorCode, LoadstarError } from '@loadstar/kernel'
import type { SideloadIdentityPlan } from '@loadstar/signer'

/** Every bundle identifier the plans need an App ID for (main apps and their extensions), once each. */
export const plannedIdentifiers = (
  plans: readonly SideloadIdentityPlan[]
): string[] => [
  ...new Set(
    plans.flatMap((plan) => plan.bundles.map((bundle) => bundle.identifier))
  )
]

/** `apple.app_id_quota` with how many are needed and when the next slot frees up, unless the plan fits. */
export const assertAppIdBudget = (plan: AppIdPlan): void => {
  if (plan.enough) return
  throw new LoadstarError(ErrorCode.AppIdQuotaExceeded, {
    data: compact({
      needed: plan.create.length,
      available: plan.available,
      nextSlotAt: plan.nextSlotAt?.toISOString()
    })
  })
}
