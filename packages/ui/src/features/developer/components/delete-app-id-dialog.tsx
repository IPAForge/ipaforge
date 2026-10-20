import { useTranslation } from 'react-i18next'

import { ConfirmDialog } from '@ui/features/developer/components/confirm-dialog.tsx'
import type { PortalContext } from '@ui/features/developer/types.ts'
import { usePortalActions } from '@ui/hooks/queries/use-portal-actions.ts'
import type { TeamAppId } from '@ui/services/engine/types.ts'

type DeleteAppIdDialogProps = {
  context: PortalContext
  appId: TeamAppId
  isFree: boolean
  onClose: () => void
}

/** Asks before deleting an unused App ID; on a free team, deleting it doesn't give its slot back sooner. */
export const DeleteAppIdDialog = ({
  context,
  appId,
  isFree,
  onClose
}: DeleteAppIdDialogProps) => {
  const { t } = useTranslation()
  const { deleteAppId } = usePortalActions(context.query, context.device?.udid)
  const onConfirm = () => deleteAppId.mutate(appId.id, { onSuccess: onClose })

  return (
    <ConfirmDialog
      title={t('portal.deleteDialog.title')}
      confirmLabel={t('portal.appIds.delete')}
      isPending={deleteAppId.isPending}
      error={deleteAppId.error}
      onConfirm={onConfirm}
      onClose={onClose}
    >
      <p className="break-all font-mono text-muted text-xs">
        {appId.identifier}
      </p>
      <p>
        {t(isFree ? 'portal.deleteDialog.free' : 'portal.deleteDialog.paid')}
      </p>
    </ConfirmDialog>
  )
}
