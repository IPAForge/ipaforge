import { useTranslation } from 'react-i18next'

import { ConfirmDialog } from '@ui/features/developer/components/confirm-dialog.tsx'
import type { PortalContext } from '@ui/features/developer/types.ts'
import { usePortalActions } from '@ui/hooks/queries/use-portal-actions.ts'
import type { DeviceProfile } from '@ui/services/engine/types.ts'

type RemoveProfilesDialogProps = {
  context: PortalContext
  deviceName: string
  profiles: readonly DeviceProfile[]
  onClose: () => void
}

/** Asks before removing expired or unused profiles from the device. */
export const RemoveProfilesDialog = ({
  context,
  deviceName,
  profiles,
  onClose
}: RemoveProfilesDialogProps) => {
  const { t } = useTranslation()
  const { removeProfiles } = usePortalActions(
    context.query,
    context.device?.udid
  )
  const onConfirm = () =>
    removeProfiles.mutate(
      profiles.map((profile) => profile.uuid),
      { onSuccess: onClose }
    )

  return (
    <ConfirmDialog
      title={t('portal.removeDialog.title', { count: profiles.length })}
      confirmLabel={t('portal.profiles.remove')}
      isPending={removeProfiles.isPending}
      error={removeProfiles.error}
      onConfirm={onConfirm}
      onClose={onClose}
    >
      <ul className="list-disc ps-5">
        {profiles.map((profile) => (
          <li key={profile.uuid} className="break-all">
            {profile.name}
          </li>
        ))}
      </ul>
      <p>
        {t('portal.removeDialog.body', {
          count: profiles.length,
          device: deviceName
        })}
      </p>
    </ConfirmDialog>
  )
}
