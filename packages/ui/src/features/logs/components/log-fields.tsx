import { Button } from '@heroui/react'
import { useTranslation } from 'react-i18next'

import { type LogEntry, REDACTED } from '@loadstar/kernel'
import { Highlighted } from '@ui/features/logs/components/highlighted.tsx'
import { fieldText } from '@ui/features/logs/utils/field-text.ts'

type LogFieldsProps = {
  entry: LogEntry
  query: string
  onCopy: (entry: LogEntry) => void
}

/** A line's details, full width under it: its scope, then each field; hidden values say so. */
export const LogFields = ({ entry, query, onCopy }: LogFieldsProps) => {
  const { t } = useTranslation()
  const fields = Object.entries(entry.fields)
  const onCopyLine = () => onCopy(entry)

  return (
    <div className="flex flex-col gap-2 border-accent border-s-2 bg-surface-secondary px-3 py-2">
      <dl className="grid grid-cols-[max-content_minmax(0,1fr)] gap-x-4 gap-y-0.5 font-mono text-xs">
        <dt className="text-muted">{t('logs.row.scope')}</dt>
        <dd className="break-all">{entry.scope ?? '-'}</dd>
        {fields.map(([name, value]) => (
          <div key={name} className="contents">
            <dt className="text-muted">{name}</dt>
            <dd className="break-all">
              {value === REDACTED ? (
                <span className="text-muted italic">
                  {t('logs.row.redacted')}
                </span>
              ) : (
                <Highlighted text={fieldText(value)} query={query} />
              )}
            </dd>
          </div>
        ))}
      </dl>
      <Button
        size="sm"
        variant="tertiary"
        className="self-start"
        onPress={onCopyLine}
      >
        {t('logs.row.copy')}
      </Button>
    </div>
  )
}
