import { useEffect, useState } from 'react'

import type { LogEntry, LogFilter } from '@ipaforge/kernel'
import { NOTE_TIMEOUT_MS } from '@ui/features/logs/constants.ts'
import type { ExportKind, LogsNote } from '@ui/features/logs/types.ts'
import { fetchAllLines } from '@ui/features/logs/utils/fetch-all-lines.ts'
import { logFileName } from '@ui/features/logs/utils/log-file-name.ts'
import { logLineText } from '@ui/features/logs/utils/log-line-text.ts'
import { useEngine } from '@ui/hooks/use-engine.ts'
import { useUiServices } from '@ui/hooks/use-ui-services.ts'

type PendingExport = {
  readonly kind: ExportKind
  readonly entries: readonly LogEntry[]
}

/**
 * Copy (the lines the filters show) and Save (every line kept this session): the lines are read first, so the
 * confirmation can say how many, then written on confirm. A short note says how it went.
 */
export const useLogExport = (filter: LogFilter) => {
  const engine = useEngine()
  const { clipboard, files, logger } = useUiServices()
  const [preparing, setPreparing] = useState<ExportKind | undefined>()
  const [pending, setPending] = useState<PendingExport | undefined>()
  const [note, setNote] = useState<LogsNote | undefined>()

  useEffect(() => {
    if (!note) return
    const timer = setTimeout(() => setNote(undefined), NOTE_TIMEOUT_MS)

    return () => clearTimeout(timer)
  }, [note])

  const prepare = (kind: ExportKind) => {
    setPreparing(kind)
    fetchAllLines(engine.logs, kind === 'copy' ? filter : {})
      .then((entries) => setPending({ kind, entries }))
      .catch(() => {
        logger.warn('could not read the logs', { kind })
        setNote({
          key:
            kind === 'copy'
              ? 'logs.export.copyFailed'
              : 'logs.export.saveFailed'
        })
      })
      .finally(() => setPreparing(undefined))
  }

  const confirm = () => {
    if (!pending) return
    const { kind, entries } = pending
    const text = entries.map(logLineText).join('\n')
    setPending(undefined)
    const written =
      kind === 'copy'
        ? clipboard.writeText(text)
        : files.save(logFileName(new Date()), text)
    written.then(
      () =>
        setNote({
          key: kind === 'copy' ? 'logs.export.copied' : 'logs.export.saved',
          count: entries.length
        }),
      () => {
        logger.warn('could not export the logs', { kind })
        setNote({
          key:
            kind === 'copy'
              ? 'logs.export.copyFailed'
              : 'logs.export.saveFailed'
        })
      }
    )
  }

  return {
    preparing,
    pending,
    note,
    prepare,
    confirm,
    cancel: () => setPending(undefined),
    showNote: setNote
  }
}
