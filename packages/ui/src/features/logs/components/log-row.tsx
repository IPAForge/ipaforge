import { useTranslation } from 'react-i18next'

import type { LogEntry } from '@ipaforge/kernel'
import { Highlighted } from '@ui/features/logs/components/highlighted.tsx'
import { LogFields } from '@ui/features/logs/components/log-fields.tsx'
import {
  LEVEL_BADGE_CLASSES,
  LEVEL_NAME_KEYS,
  LOG_AREA_KEYS,
  ROW_TONE_CLASSES
} from '@ui/features/logs/constants.ts'
import { areaOfScope } from '@ui/features/logs/utils/area-of-scope.ts'
import { useFormat } from '@ui/hooks/use-format.ts'

type LogRowProps = {
  entry: LogEntry
  query: string
  isExpanded: boolean
  onToggle: (seq: number) => void
  onCopy: (entry: LogEntry) => void
}

/** One line: time, level, area and message; pressing it shows its details underneath. */
export const LogRow = ({
  entry,
  query,
  isExpanded,
  onToggle,
  onCopy
}: LogRowProps) => {
  const { t } = useTranslation()
  const { preciseTime } = useFormat()
  const fieldCount = Object.keys(entry.fields).length
  const onPress = () => onToggle(entry.seq)

  return (
    <div className={ROW_TONE_CLASSES[entry.level]}>
      <button
        type="button"
        aria-expanded={isExpanded}
        onClick={onPress}
        className="grid w-full grid-cols-[max-content_4.5rem_minmax(0,1fr)] items-baseline gap-2.5 border-border/50 border-b px-3 py-1 text-start text-sm hover:bg-surface-secondary focus-visible:outline-2 focus-visible:outline-accent focus-visible:-outline-offset-2 sm:grid-cols-[7.5rem_4.5rem_5.5rem_minmax(0,1fr)]"
      >
        <span className="whitespace-nowrap font-mono text-muted text-xs">
          {preciseTime(new Date(entry.ts))}
        </span>
        <span
          className={`justify-self-start rounded px-1.5 font-semibold text-[0.6875rem] uppercase tracking-wide ${LEVEL_BADGE_CLASSES[entry.level]}`}
        >
          {t(LEVEL_NAME_KEYS[entry.level])}
        </span>
        <span className="hidden truncate text-muted text-xs sm:block">
          {t(LOG_AREA_KEYS[areaOfScope(entry.scope)])}
        </span>
        <span className="min-w-0 break-words">
          <Highlighted text={entry.msg} query={query} />
          {fieldCount > 0 && !isExpanded ? (
            <span className="ms-1.5 text-muted text-xs">
              {t('logs.row.details', { count: fieldCount })}
            </span>
          ) : null}
        </span>
      </button>
      {isExpanded ? (
        <LogFields entry={entry} query={query} onCopy={onCopy} />
      ) : null}
    </div>
  )
}
