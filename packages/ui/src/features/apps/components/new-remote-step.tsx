import { useTranslation } from 'react-i18next'

import { PairingConfirmStep } from '@ui/features/apps/components/pairing-confirm-step.tsx'

type NewRemoteStepProps = {
  isPending: boolean
  error: unknown
  onConfirm: () => void
  onBack: () => void
}

/** Asks before a new remote pairing: the device may ask to Trust again, and the old pairing stops working. */
export const NewRemoteStep = ({
  isPending,
  error,
  onConfirm,
  onBack
}: NewRemoteStepProps) => {
  const { t } = useTranslation()

  return (
    <PairingConfirmStep
      title={t('apps.pairing.newRemoteTitle')}
      confirmLabel={t('apps.pairing.newRemoteConfirm')}
      tone="primary"
      isPending={isPending}
      error={error}
      onConfirm={onConfirm}
      onBack={onBack}
    >
      <p>{t('apps.pairing.newRemoteBody')}</p>
      {isPending ? (
        <p className="text-muted" role="status">
          {t('apps.pairing.newRemoteWaiting')}
        </p>
      ) : null}
    </PairingConfirmStep>
  )
}
