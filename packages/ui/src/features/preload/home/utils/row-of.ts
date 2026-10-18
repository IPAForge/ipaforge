import { toIPAForgeError } from '@ipaforge/kernel'
import type { PreloadRow, RowProblem } from '@ui/features/preload/home/types.ts'
import { errorBodyKey, errorTitleKey } from '@ui/i18n/required-keys.ts'
import type { InstallPlan } from '@ui/services/engine/types.ts'
import type { PreloadItem } from '@ui/state/preload/types.ts'

/** What the plan query of one app has to say, as TanStack Query reports it. */
export type PlanState = {
  readonly data: InstallPlan | undefined
  readonly error: unknown
  readonly isPending: boolean
}

const REFUSALS = {
  'not-ipa': { kind: 'message', key: 'preload.problem.notIpa' },
  unreadable: { kind: 'message', key: 'preload.problem.unreadable' }
} as const satisfies Record<string, RowProblem>

/** An app the device can't run: its exact iOS when that's the reason, else the error's own words. */
const incompatible = (
  compatibility: NonNullable<InstallPlan['compatibility']>
): RowProblem => {
  const data = compatibility.data as Readonly<Record<string, unknown>>
  if (
    typeof data.minimumOSVersion === 'string' &&
    typeof data.iosVersion === 'string'
  )
    return {
      kind: 'needs-ios',
      needs: data.minimumOSVersion,
      has: data.iosVersion
    }
  return {
    kind: 'message',
    key: errorTitleKey(compatibility.code),
    detailKey: errorBodyKey(compatibility.code)
  }
}

/** One row of the list: refused, waiting, being read (a link is downloaded first), ready or unable to install. */
export const rowOf = (
  item: PreloadItem,
  plan: PlanState,
  canPlan: boolean
): PreloadRow => {
  if (item.refused)
    return { item, status: 'problem', problem: REFUSALS[item.refused] }
  if (!canPlan) return { item, status: 'waiting' }
  if (plan.error) {
    const { code } = toIPAForgeError(plan.error)

    return {
      item,
      status: 'problem',
      problem: {
        kind: 'message',
        key: errorTitleKey(code),
        detailKey: errorBodyKey(code)
      }
    }
  }
  if (!plan.data)
    return {
      item,
      status: item.source?.kind === 'url' ? 'downloading' : 'checking'
    }
  if (plan.data.compatibility)
    return {
      item,
      status: 'problem',
      plan: plan.data,
      problem: incompatible(plan.data.compatibility)
    }
  return { item, status: 'ready', plan: plan.data }
}
