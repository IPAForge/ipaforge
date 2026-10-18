import { LOG_PAGE_MAX, type LogEntry, type LogFilter } from '@loadstar/kernel'
import type { EngineLogs } from '@loadstar/rpc'

/** Every line matching `filter`, oldest first, read from the Engine a page at a time (for Copy and Save). */
export const fetchAllLines = async (
  logs: EngineLogs,
  filter: LogFilter
): Promise<readonly LogEntry[]> => {
  const pages: (readonly LogEntry[])[] = []
  let before: number | undefined
  for (;;) {
    const page = await logs.page({
      ...filter,
      limit: LOG_PAGE_MAX,
      ...(before === undefined ? {} : { before })
    })
    pages.unshift(page.entries)
    before = page.entries[0]?.seq
    if (!page.hasMore || before === undefined) break
  }
  return pages.flat()
}
