import { Button } from '@heroui/react'
import { useTranslation } from 'react-i18next'

import { EMPTY_TEXT_KEYS } from '@ui/features/logs/constants.ts'
import type { LogsEmptyKind } from '@ui/features/logs/types.ts'

type LogsEmptyProps = {
  kind: LogsEmptyKind
  onShowAll: () => void
}

/** Why the list is empty: nothing logged yet, nothing matches, the view was cleared, or the Engine didn't answer. */
export const LogsEmpty = ({ kind, onShowAll }: LogsEmptyProps) => {
  const { t } = useTranslation()
  const [title, body] = EMPTY_TEXT_KEYS[kind]

  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center text-muted">
      <p className="font-semibold text-foreground">{t(title)}</p>
      <p className="text-sm">{t(body)}</p>
      {kind === 'no-match' ? (
        <Button size="sm" variant="secondary" onPress={onShowAll}>
          {t('logs.empty.noMatch.showAll')}
        </Button>
      ) : null}
    </div>
  )
}
