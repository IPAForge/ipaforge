import { useTranslation } from 'react-i18next'

import { PairingConfirmStep } from '@ui/features/apps/components/pairing-confirm-step.tsx'
import type { AppPairing } from '@ui/services/engine/types.ts'

type RemovePairingStepProps = {
  app: AppPairing
  isPending: boolean
  error: unknown
  onConfirm: (app: AppPairing) => void
  onBack: () => void
}

/** Asks before deleting an app's pairing files: it can't reach the device by itself until one is placed again. */
export const RemovePairingStep = ({
  app,
  isPending,
  error,
  onConfirm,
  onBack
}: RemovePairingStepProps) => {
  const { t } = useTranslation()
  const onConfirmPress = () => onConfirm(app)

  return (
    <PairingConfirmStep
      title={t('apps.pairing.removeTitle', { name: app.name })}
      confirmLabel={t('apps.pairing.remove')}
      tone="danger"
      isPending={isPending}
      error={error}
      onConfirm={onConfirmPress}
      onBack={onBack}
    >
      {app.path ? (
        <p className="break-all font-mono text-muted text-xs">{app.path}</p>
      ) : null}
      <p>{t('apps.pairing.removeBody')}</p>
    </PairingConfirmStep>
  )
}
