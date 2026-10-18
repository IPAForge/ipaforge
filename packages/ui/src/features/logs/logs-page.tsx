import { Card } from '@heroui/react'

import type { LogEntry } from '@loadstar/kernel'
import { ExportDialog } from '@ui/features/logs/components/export-dialog.tsx'
import { LogAreaSelect } from '@ui/features/logs/components/log-area-select.tsx'
import { LogFilterChips } from '@ui/features/logs/components/log-filter-chips.tsx'
import { LogFooter } from '@ui/features/logs/components/log-footer.tsx'
import { LogLevelFilter } from '@ui/features/logs/components/log-level-filter.tsx'
import { LogList } from '@ui/features/logs/components/log-list.tsx'
import { LogSearch } from '@ui/features/logs/components/log-search.tsx'
import { LogsHeader } from '@ui/features/logs/components/logs-header.tsx'
import { PrivacyNote } from '@ui/features/logs/components/privacy-note.tsx'
import { useLogExport } from '@ui/features/logs/hooks/use-log-export.ts'
import { useLogFilter } from '@ui/features/logs/hooks/use-log-filter.ts'
import { useLogLines } from '@ui/features/logs/hooks/use-log-lines.ts'
import { useLogScroll } from '@ui/features/logs/hooks/use-log-scroll.ts'
import { emptyKind } from '@ui/features/logs/utils/empty-kind.ts'
import { linesAtLeast } from '@ui/features/logs/utils/lines-at-least.ts'
import { logLineText } from '@ui/features/logs/utils/log-line-text.ts'
import { useLogView } from '@ui/hooks/use-log-view.ts'
import { useUiServices } from '@ui/hooks/use-ui-services.ts'

/**
 * Manage → Logs: the Engine's and the UI's lines, newest at the bottom. Filters and search run in the Engine and
 * pages load as the list scrolls up, so the page never holds the whole log; new lines are pushed as they happen.
 */
export const LogsPage = () => {
  const { clipboard } = useUiServices()
  const { view, setMinLevel, setArea, setText, clear, showAll } = useLogView()
  const filter = useLogFilter()
  const lines = useLogLines(filter)
  const scroll = useLogScroll(lines)
  const exporting = useLogExport(filter)
  const total = linesAtLeast(lines.counts, 'debug')
  const onClear = () => {
    clear(lines.lastSeq)
    exporting.showNote({ key: 'logs.cleared' })
  }
  const onCopyLine = (entry: LogEntry) =>
    clipboard.writeText(logLineText(entry)).then(
      () => exporting.showNote({ key: 'logs.export.copied', count: 1 }),
      () => exporting.showNote({ key: 'logs.export.copyFailed' })
    )

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <LogsHeader
        preparing={exporting.preparing}
        note={exporting.note}
        onExport={exporting.prepare}
        onClear={onClear}
      />
      <div className="flex flex-wrap items-center gap-2">
        <LogSearch value={view.text} onChange={setText} />
        <LogLevelFilter
          value={view.minLevel}
          counts={lines.counts}
          onChange={setMinLevel}
        />
        <LogAreaSelect value={view.area} onChange={setArea} />
      </div>
      <LogFilterChips />
      <Card className="flex min-h-[24rem] flex-1 flex-col overflow-hidden p-0">
        <LogList
          lines={lines}
          scroll={scroll}
          query={filter.text ?? ''}
          emptyKind={emptyKind(view, lines.isError, total)}
          onShowAll={showAll}
          onCopyLine={onCopyLine}
        />
        <LogFooter
          follow={scroll.follow}
          matching={linesAtLeast(lines.counts, view.minLevel)}
          onPause={scroll.pause}
          onFollow={scroll.jumpToLatest}
        />
      </Card>
      <PrivacyNote />
      {exporting.pending ? (
        <ExportDialog
          kind={exporting.pending.kind}
          count={exporting.pending.entries.length}
          onConfirm={exporting.confirm}
          onCancel={exporting.cancel}
        />
      ) : null}
    </div>
  )
}
