import { useTranslation } from 'react-i18next'

import { ConfirmDialog } from '@ui/features/developer/components/confirm-dialog.tsx'
import { SignedApps } from '@ui/features/developer/components/signed-apps.tsx'
import { revokeNoteKeys } from '@ui/features/developer/constants.ts'
import type {
  CertificateMaker,
  PortalContext
} from '@ui/features/developer/types.ts'
import { appsSignedBy } from '@ui/features/developer/utils/apps-signed-by.ts'
import { usePortalActions } from '@ui/hooks/queries/use-portal-actions.ts'
import type { TeamCertificate } from '@ui/services/engine/types.ts'

type RevokeDialogProps = {
  context: PortalContext
  certificate: TeamCertificate
  maker: CertificateMaker
  onClose: () => void
}

/** Asks before revoking a certificate, naming the apps on the device that stop opening and what its maker does next. */
export const RevokeDialog = ({
  context,
  certificate,
  maker,
  onClose
}: RevokeDialogProps) => {
  const { t } = useTranslation()
  const { revoke } = usePortalActions(context.query, context.device?.udid)
  const signed = appsSignedBy(certificate.serialNumber, context.apps)
  const deviceName = context.device?.name
  const noteKey = Object.hasOwn(revokeNoteKeys, maker)
    ? revokeNoteKeys[maker as keyof typeof revokeNoteKeys]
    : undefined
  const onConfirm = () =>
    revoke.mutate(certificate.serialNumber, { onSuccess: onClose })

  return (
    <ConfirmDialog
      title={t('portal.revokeDialog.title')}
      confirmLabel={t('portal.certificates.revoke')}
      isPending={revoke.isPending}
      error={revoke.error}
      onConfirm={onConfirm}
      onClose={onClose}
    >
      <p className="break-all font-mono text-muted text-xs">
        {certificate.serialNumber}
      </p>
      {deviceName === undefined ? (
        <p>{t('portal.revokeDialog.noDevice')}</p>
      ) : (
        <SignedApps apps={signed} deviceName={deviceName} />
      )}
      {noteKey ? <p className="text-muted">{t(noteKey)}</p> : null}
      <p className="text-muted">{t('portal.revokeDialog.exportedToo')}</p>
    </ConfirmDialog>
  )
}
