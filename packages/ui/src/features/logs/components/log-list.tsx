import { Spinner } from '@heroui/react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import type { LogEntry } from '@ipaforge/kernel'
import { JumpToLatest } from '@ui/features/logs/components/jump-to-latest.tsx'
import { LogRow } from '@ui/features/logs/components/log-row.tsx'
import { LogsEmpty } from '@ui/features/logs/components/logs-empty.tsx'
import type { useLogScroll } from '@ui/features/logs/hooks/use-log-scroll.ts'
import type { LogLines, LogsEmptyKind } from '@ui/features/logs/types.ts'

type LogListProps = {
  lines: LogLines
  scroll: ReturnType<typeof useLogScroll>
  query: string
  emptyKind: LogsEmptyKind
  onShowAll: () => void
  onCopyLine: (entry: LogEntry) => void
}

/**
 * The lines in a virtual list: only the rows on screen (and a few around them) are in the page, whatever the
 * number of lines; rows that show their details are measured as they render.
 */
export const LogList = ({
  lines,
  scroll,
  query,
  emptyKind,
  onShowAll,
  onCopyLine
}: LogListProps) => {
  const { t } = useTranslation()
  const [expanded, setExpanded] = useState<ReadonlySet<number>>(new Set())
  const { scrollRef, virtualizer, follow, jumpToLatest } = scroll
  const { entries } = lines
  const onToggle = (seq: number) =>
    setExpanded((current) => {
      const next = new Set(current)
      if (!next.delete(seq)) next.add(seq)
      return next
    })

  return (
    <div className="relative min-h-0 flex-1">
      <div
        ref={scrollRef}
        role="log"
        aria-live="off"
        aria-label={t('logs.list.label')}
        aria-busy={lines.isLoading}
        className="h-full overflow-auto overscroll-contain"
      >
        {lines.isLoadingOlder ? (
          <p className="flex items-center justify-center gap-2 py-2 text-muted text-xs">
            <Spinner size="sm" />
            {t('logs.list.loadingOlder')}
          </p>
        ) : null}
        {entries.length === 0 && !lines.isLoading ? (
          <LogsEmpty kind={emptyKind} onShowAll={onShowAll} />
        ) : (
          <div
            className="relative w-full"
            style={{ height: virtualizer.getTotalSize() }}
          >
            {virtualizer.getVirtualItems().map((item) => {
              const entry = entries[item.index]
              if (!entry) return null
              return (
                <div
                  key={item.key}
                  data-index={item.index}
                  ref={virtualizer.measureElement}
                  className="absolute start-0 top-0 w-full"
                  style={{ transform: `translateY(${item.start}px)` }}
                >
                  <LogRow
                    entry={entry}
                    query={query}
                    isExpanded={expanded.has(entry.seq)}
                    onToggle={onToggle}
                    onCopy={onCopyLine}
                  />
                </div>
              )
            })}
          </div>
        )}
      </div>
      {!follow.isFollowing && follow.unseen > 0 ? (
        <JumpToLatest unseen={follow.unseen} onJump={jumpToLatest} />
      ) : null}
    </div>
  )
}
