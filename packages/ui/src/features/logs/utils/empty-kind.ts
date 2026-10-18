import type { LogsEmptyKind } from '@ui/features/logs/types.ts'
import type { LogViewState } from '@ui/state/log-view/types.ts'

/** Why nothing is listed: the Engine failed, the view was cleared, filters hide every line, or nothing is logged. */
export const emptyKind = (
  view: LogViewState,
  isError: boolean,
  total: number
): LogsEmptyKind => {
  if (isError) return 'failed'
  if (view.clearedAfter > 0 && total === 0) return 'cleared'
  return total > 0 ? 'no-match' : 'none'
}
