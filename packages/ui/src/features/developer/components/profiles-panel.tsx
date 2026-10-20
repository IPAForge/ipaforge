import { Button } from '@heroui/react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { PortalCard } from '@ui/features/developer/components/portal-card.tsx'
import { PortalList } from '@ui/features/developer/components/portal-list.tsx'
import { PortalRow } from '@ui/features/developer/components/portal-row.tsx'
import { RemoveProfilesDialog } from '@ui/features/developer/components/remove-profiles-dialog.tsx'
import type {
  PortalContext,
  PortalData,
  PortalRowView,
  RowTag
} from '@ui/features/developer/types.ts'
import { appOfBundle } from '@ui/features/developer/utils/app-of-bundle.ts'
import { isPast } from '@ui/features/developer/utils/is-past.ts'
import { isRemovable } from '@ui/features/developer/utils/is-removable.ts'
import { useFormat } from '@ui/hooks/use-format.ts'
import type { DeviceProfile } from '@ui/services/engine/types.ts'

type ProfilesPanelProps = {
  context: PortalContext
  profiles: PortalData['profiles']
}

/**
 * The provisioning profiles on the device in use: the app each lets run, when it expires, and Remove for expired
 * or unused ones (one at a time or all at once). Profiles of another Apple ID's teams are shown too, tagged.
 */
export const ProfilesPanel = ({ context, profiles }: ProfilesPanelProps) => {
  const { t } = useTranslation()
  const { date } = useFormat()
  const [removing, setRemoving] = useState<readonly DeviceProfile[]>()
  const items = profiles.data ?? []
  const removable = items.filter(isRemovable)
  const teamIds = new Set(context.teams.map((team) => team.id))
  const deviceName = context.device?.name
  const onClose = () => setRemoving(undefined)
  const onRemoveUnused = () => setRemoving(removable)
  const viewOf = (profile: DeviceProfile): PortalRowView => {
    const app = appOfBundle(profile.bundleId, context.apps)
    const isExpired = isPast(profile.expiresAt)
    const tags: RowTag[] = [
      ...(isExpired
        ? [{ labelKey: 'portal.expired', tone: 'bad' } as const]
        : []),
      ...(profile.isUsed
        ? []
        : [{ labelKey: 'portal.appIds.unused', tone: 'warn' } as const]),
      ...(profile.teamId === undefined || teamIds.has(profile.teamId)
        ? []
        : [{ labelKey: 'portal.profiles.otherTeam', tone: 'neutral' } as const])
    ]
    const expiryKey = isExpired ? 'portal.expiredOn' : 'portal.expires'
    const expiry = profile.expiresAt
      ? t(expiryKey, { date: date(new Date(profile.expiresAt)) })
      : undefined

    return {
      id: profile.uuid,
      title: app?.name ?? t('portal.profiles.noApp'),
      tags,
      code: profile.bundleId ?? profile.uuid,
      details: [profile.name, ...(expiry ? [expiry] : [])]
    }
  }

  if (deviceName === undefined)
    return (
      <PortalCard
        title={t('portal.tabs.profiles')}
        hint={t('portal.profiles.hint')}
      >
        <p className="text-muted text-sm">{t('portal.profiles.noDevice')}</p>
      </PortalCard>
    )

  return (
    <PortalCard
      title={t('portal.profiles.title', { device: deviceName })}
      hint={t('portal.profiles.hint')}
      action={
        <Button
          size="sm"
          variant="secondary"
          onPress={onRemoveUnused}
          isDisabled={removable.length === 0}
        >
          {t('portal.profiles.removeUnused')}
        </Button>
      }
    >
      <PortalList
        label={t('portal.tabs.profiles')}
        isPending={profiles.isPending}
        error={profiles.error}
        isEmpty={items.length === 0}
        emptyKey="portal.profiles.empty"
      >
        {items.map((profile) => {
          const view = viewOf(profile)
          const onRemove = () => setRemoving([profile])

          return (
            <PortalRow
              key={view.id}
              view={view}
              actions={
                isRemovable(profile) ? (
                  <Button
                    size="sm"
                    variant="tertiary"
                    onPress={onRemove}
                    aria-label={t('portal.profiles.removeOne', {
                      name: view.title
                    })}
                  >
                    {t('portal.profiles.remove')}
                  </Button>
                ) : undefined
              }
            />
          )
        })}
      </PortalList>
      {removing ? (
        <RemoveProfilesDialog
          context={context}
          deviceName={deviceName}
          profiles={removing}
          onClose={onClose}
        />
      ) : null}
    </PortalCard>
  )
}
