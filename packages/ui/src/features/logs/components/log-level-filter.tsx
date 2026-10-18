import { RadioButton, RadioField, RadioGroup } from 'react-aria-components'
import { useTranslation } from 'react-i18next'

import type { LogLevel } from '@ipaforge/kernel'
import { segmentClass } from '@ui/features/install/home/utils/choice-classes.ts'
import { LEVEL_FILTER_KEYS, LOG_LEVELS } from '@ui/features/logs/constants.ts'
import { linesAtLeast } from '@ui/features/logs/utils/lines-at-least.ts'
import { useFormat } from '@ui/hooks/use-format.ts'

type LogLevelFilterProps = {
  value: LogLevel
  counts: Readonly<Record<LogLevel, number>>
  onChange: (level: LogLevel) => void
}

/** From every line to errors only, each with how many lines it shows; the chosen one is filled in the accent colour. */
export const LogLevelFilter = ({
  value,
  counts,
  onChange
}: LogLevelFilterProps) => {
  const { t } = useTranslation()
  const { number } = useFormat()
  const onValueChange = (next: string) => {
    const level = LOG_LEVELS.find((candidate) => candidate === next)
    if (level) onChange(level)
  }

  return (
    <RadioGroup
      aria-label={t('logs.level.label')}
      value={value}
      onChange={onValueChange}
      orientation="horizontal"
      className="flex rounded-full bg-surface-secondary p-1"
    >
      {LOG_LEVELS.map((level) => (
        <RadioField key={level} value={level}>
          <RadioButton className={segmentClass}>
            {t(LEVEL_FILTER_KEYS[level])}{' '}
            <span className="text-xs opacity-75">
              {number(linesAtLeast(counts, level))}
            </span>
          </RadioButton>
        </RadioField>
      ))}
    </RadioGroup>
  )
}
