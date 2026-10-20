import type { TFunction } from 'i18next'

import type { Formatters } from '@ui/i18n/formatters.ts'
import type { InstalledApp } from '@ui/services/engine/types.ts'

/** Which apps on the device a certificate signs: "Signs SideStore and StikDebug on iPhone", or nothing. */
export const signsText = (
  t: TFunction,
  list: Formatters['list'],
  signed: readonly InstalledApp[],
  device: string
): string =>
  signed.length > 0
    ? t('portal.certificates.signs', {
        apps: list(signed.map((app) => app.name)),
        device
      })
    : t('portal.certificates.signsNothing', { device })
