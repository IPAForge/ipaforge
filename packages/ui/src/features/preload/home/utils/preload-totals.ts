import type {
  PreloadRow,
  PreloadTotals
} from '@ui/features/preload/home/types.ts'
import type { InstallPlan } from '@ui/services/engine/types.ts'

/** Slots the device's free apps hold now: the first plan's, plus its own app when that is already installed. */
const usedSlots = (plan: InstallPlan) =>
  (plan.freeSlots?.occupied.length ?? 0) + (plan.installedVersion ? 1 : 0)

/**
 * The ready apps added up: the App IDs they need against what's left this week, and the free-app slots after the
 * install (an app already on the device takes no new slot). The account-wide facts come from the first plan.
 */
export const preloadTotals = (rows: readonly PreloadRow[]): PreloadTotals => {
  const plans = rows.flatMap((row) =>
    row.status === 'ready' && row.plan ? [row.plan] : []
  )
  const [first] = plans
  const newAppIds = plans.reduce(
    (total, plan) => total + plan.appIds.create.length,
    0
  )
  const isFree = first?.team.isFree ?? true
  const available = isFree ? first?.appIds.available : undefined
  // An app saved as a signed .ipa goes on no device: it takes no free-app slot.
  const newApps = rows.filter(
    (row) =>
      row.status === 'ready' &&
      row.plan &&
      !row.plan.installedVersion &&
      row.item.save !== true
  ).length
  const used = first ? usedSlots(first) : 0

  return {
    apps: plans.length,
    newAppIds,
    available,
    enough: available === undefined || newAppIds <= available,
    nextSlotAt: first?.appIds.nextSlotAt
      ? new Date(first.appIds.nextSlotAt)
      : undefined,
    freeApps:
      first?.freeSlots && isFree
        ? { used, after: used + newApps, limit: first.freeSlots.limit }
        : undefined,
    certificateReused: first?.certificate.reusable ?? false,
    team: first?.team
  }
}
