import { Button, Spinner } from '@heroui/react'
import { useTranslation } from 'react-i18next'

import { pairingPlaceKeys } from '@ui/features/apps/constants.ts'
import { pairingDetail } from '@ui/features/apps/utils/pairing-detail.ts'
import { pairingTags } from '@ui/features/apps/utils/pairing-tags.ts'
import { placeKind } from '@ui/features/apps/utils/place-kind.ts'
import { PortalRow } from '@ui/features/developer/components/portal-row.tsx'
import { useFormat } from '@ui/hooks/use-format.ts'
import type { AppPairing } from '@ui/services/engine/types.ts'

type PairingRowProps = {
  app: AppPairing
  isFocused: boolean
  isPlacing: boolean
  isBusy: boolean
  onPlace: (app: AppPairing) => void
  onRemove: (app: AppPairing) => void
}

/**
 * One app in Pairing files: whose pairing files it holds (an own app: where), and Place (Place again, or Add… for an
 * app of your own, which asks where) and Remove.
 */
export const PairingRow = ({
  app,
  isFocused,
  isPlacing,
  isBusy,
  onPlace,
  onRemove
}: PairingRowProps) => {
  const { t } = useTranslation()
  const format = useFormat()
  const detail = pairingDetail(t, format, app)
  const hasFile = app.classic !== 'missing'
  const placeKeys = pairingPlaceKeys[placeKind(app)]
  const onPlacePress = () => onPlace(app)
  const onRemovePress = () => onRemove(app)

  return (
    <PortalRow
      isHighlighted={isFocused}
      view={{
        id: app.bundleId,
        title: app.name,
        tags: pairingTags(app),
        ...(app.path ? { code: app.path } : {}),
        details: detail ? [detail] : []
      }}
      actions={
        <>
          <Button
            size="sm"
            variant="secondary"
            onPress={onPlacePress}
            isDisabled={isBusy}
            aria-label={t(placeKeys.one, { name: app.name })}
          >
            {isPlacing ? <Spinner size="sm" color="current" /> : null}
            {t(placeKeys.label)}
          </Button>
          {hasFile ? (
            <Button
              size="sm"
              variant="tertiary"
              onPress={onRemovePress}
              isDisabled={isBusy}
              aria-label={t('apps.pairing.removeOne', { name: app.name })}
            >
              {t('apps.pairing.remove')}
            </Button>
          ) : null}
        </>
      }
    />
  )
}
