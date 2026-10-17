import { Button } from '@heroui/react'
import { ClipboardCopy } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useUiServices } from '@ui/hooks/use-ui-services.ts'

type CopyDiagnosticsProps = { text: string }

/** Copies the diagnostics for a bug report, and says whether that worked. */
export const CopyDiagnostics = ({ text }: CopyDiagnosticsProps) => {
  const { t } = useTranslation()
  const { clipboard, logger } = useUiServices()
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle')
  const onCopy = () =>
    clipboard.writeText(text).then(
      () => setState('copied'),
      () => {
        logger.warn('could not copy the diagnostics')
        setState('failed')
      }
    )

  return (
    <>
      <Button variant="tertiary" onPress={onCopy}>
        <ClipboardCopy aria-hidden="true" className="size-4" />
        {t('install.failed.copy')}
      </Button>
      {state === 'idle' ? null : (
        <span role="status" className="text-sm">
          {t(
            state === 'copied'
              ? 'install.failed.copied'
              : 'install.failed.copyFailed'
          )}
        </span>
      )}
    </>
  )
}
