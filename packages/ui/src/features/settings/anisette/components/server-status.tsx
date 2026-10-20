import { Spinner } from '@heroui/react'
import { useTranslation } from 'react-i18next'

import { statusClasses } from '@ui/features/settings/anisette/constants.ts'
import type { ServerTestState } from '@ui/features/settings/anisette/types.ts'

type ServerStatusProps = { state: ServerTestState | undefined }

/** A server's last test: Not tested, Testing…, Working · 240 ms, or Not responding. */
export const ServerStatus = ({ state }: ServerStatusProps) => {
  const { t } = useTranslation()
  const phase = state?.phase ?? 'untested'
  const classes = statusClasses[phase]

  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap text-sm tabular-nums ${classes.text}`}
    >
      {phase === 'testing' ? (
        <Spinner size="sm" />
      ) : (
        <span
          aria-hidden="true"
          className={`size-2 shrink-0 rounded-full ${classes.dot}`}
        />
      )}
      {state?.phase === 'ok'
        ? t('settings.anisette.status.ok', { ms: state.latencyMs })
        : t(`settings.anisette.status.${phase}`)}
    </span>
  )
}
