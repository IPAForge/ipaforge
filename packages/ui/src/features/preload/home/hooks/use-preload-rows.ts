import { skipToken, useQueries } from '@tanstack/react-query'

import type { PreloadRow } from '@ui/features/preload/home/types.ts'
import { rowOf } from '@ui/features/preload/home/utils/row-of.ts'
import { queryKeys } from '@ui/hooks/queries/query-keys.ts'
import { useEngine } from '@ui/hooks/use-engine.ts'
import type { PreloadItem } from '@ui/state/preload/types.ts'

/** The device and Apple ID the apps are planned for, once both can be asked. */
export type PlanTarget = { readonly udid: string; readonly accountId: string }

/**
 * Each app of the list with the Engine's plan for it (`planInstall`, one per app, asked once and cached): what it
 * is, whether the device can run it, the App IDs it needs. Nothing is asked until the device and Apple ID are ready.
 */
export const usePreloadRows = (
  items: readonly PreloadItem[],
  target: PlanTarget | undefined
): readonly PreloadRow[] => {
  const engine = useEngine()
  const plans = useQueries({
    queries: items.map((item) => {
      const input =
        target && item.source ? { ...target, source: item.source } : undefined

      return {
        queryKey: queryKeys.planInstall(input),
        queryFn: input ? () => engine.planInstall(input) : skipToken,
        retry: false
      }
    })
  })

  return items.map((item, index) => {
    const plan = plans[index]

    return rowOf(
      item,
      {
        data: plan?.data,
        error: plan?.error ?? undefined,
        isPending: plan?.isPending ?? true
      },
      target !== undefined
    )
  })
}
