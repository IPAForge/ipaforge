import { useTranslation } from 'react-i18next'

import { LogFilterChip } from '@ui/features/logs/components/log-filter-chip.tsx'
import { LOG_AREA_KEYS } from '@ui/features/logs/constants.ts'
import { useFormat } from '@ui/hooks/use-format.ts'
import { useLogView } from '@ui/hooks/use-log-view.ts'

/** The filters that narrow the lines beyond the level, each removable: the install run, the area, the search. */
export const LogFilterChips = () => {
  const { t } = useTranslation()
  const { time } = useFormat()
  const { view, clearRun, setArea, setText } = useLogView()
  const { run, area, text } = view
  const onRemoveArea = () => setArea(undefined)
  const onRemoveText = () => setText('')
  if (!run && !area && !text) return null

  return (
    <div className="flex flex-wrap items-center gap-1.5 text-muted text-sm">
      {t('logs.filters.showing')}
      {run ? (
        <LogFilterChip
          label={t('logs.filters.run', { time: time(new Date(run.from)) })}
          onRemove={clearRun}
        />
      ) : null}
      {area ? (
        <LogFilterChip label={t(LOG_AREA_KEYS[area])} onRemove={onRemoveArea} />
      ) : null}
      {text ? (
        <LogFilterChip
          label={t('logs.filters.text', { text })}
          onRemove={onRemoveText}
        />
      ) : null}
    </div>
  )
}
