import { compact, type LogFilter } from '@loadstar/kernel'
import { LOG_AREA_SCOPES } from '@ui/features/logs/constants.ts'
import type { LogViewState } from '@ui/state/log-view/types.ts'

/** What the Engine is asked for: the view's filters, with the search as typed so far. */
export const logFilterOf = (view: LogViewState, text: string): LogFilter =>
  compact({
    minLevel: view.minLevel,
    scopes: view.area ? LOG_AREA_SCOPES[view.area] : undefined,
    text: text.trim() || undefined,
    from: view.run?.from,
    to: view.run?.to,
    after: view.clearedAfter || undefined
  })
