import { useMemo } from 'react'

import type { LogFilter } from '@loadstar/kernel'
import { SEARCH_DELAY_MS } from '@ui/features/logs/constants.ts'
import { useDebounced } from '@ui/features/logs/hooks/use-debounced.ts'
import { logFilterOf } from '@ui/features/logs/utils/log-filter-of.ts'
import { useLogView } from '@ui/hooks/use-log-view.ts'

/** What to ask the Engine for: the view's filters, the search once typing pauses. */
export const useLogFilter = (): LogFilter => {
  const { view } = useLogView()
  const text = useDebounced(view.text, SEARCH_DELAY_MS)

  return useMemo(() => logFilterOf(view, text), [view, text])
}
