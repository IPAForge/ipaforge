import { Button, Kbd } from '@heroui/react'
import { Copy, Download, Eraser } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import type { ExportKind, LogsNote } from '@ui/features/logs/types.ts'
import { isApplePlatform } from '@ui/features/logs/utils/is-apple-platform.ts'

type LogsHeaderProps = {
  preparing: ExportKind | undefined
  note: LogsNote | undefined
  onExport: (kind: ExportKind) => void
  onClear: () => void
}

/** The title, the shortcut that opens Logs, and Copy, Save and Clear with a note on how they went. */
export const LogsHeader = ({
  preparing,
  note,
  onExport,
  onClear
}: LogsHeaderProps) => {
  const { t } = useTranslation()
  const onCopy = () => onExport('copy')
  const onSave = () => onExport('save')
  const modifier = t(
    isApplePlatform() ? 'logs.shortcut.command' : 'logs.shortcut.control'
  )

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="me-auto flex flex-col gap-1">
        <h1 className="font-semibold text-2xl">{t('logs.title')}</h1>
        <p className="text-muted">
          {t('logs.lede')}{' '}
          <Kbd>
            {modifier}
            {t('logs.shortcut.key')}
          </Kbd>
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {note ? (
          <span role="status" className="text-sm">
            {'count' in note ? t(note.key, { count: note.count }) : t(note.key)}
          </span>
        ) : null}
        <Button
          variant="secondary"
          isPending={preparing === 'copy'}
          onPress={onCopy}
        >
          <Copy aria-hidden="true" className="size-4" />
          {t('logs.copy')}
        </Button>
        <Button
          variant="secondary"
          isPending={preparing === 'save'}
          onPress={onSave}
        >
          <Download aria-hidden="true" className="size-4" />
          {t('logs.save')}
        </Button>
        <Button variant="tertiary" onPress={onClear}>
          <Eraser aria-hidden="true" className="size-4" />
          {t('logs.clear')}
        </Button>
      </div>
    </div>
  )
}
