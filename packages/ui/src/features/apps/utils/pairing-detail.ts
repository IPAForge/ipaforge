import type { TFunction } from 'i18next'

import type { Formatters } from '@ui/i18n/formatters.ts'
import type { AppPairing } from '@ui/services/engine/types.ts'

/** The line under an app in Pairing files: when it was placed, that it's another computer's, or that it has none. */
export const pairingDetail = (
  t: TFunction,
  format: Formatters,
  app: AppPairing
): string | undefined => {
  if (app.kind === 'own' && app.classic === 'missing')
    return t('apps.pairing.detail.ownNone')
  if (app.classic === 'missing') return t('apps.pairing.detail.needed')
  if (app.classic === 'other-computer')
    return t('apps.pairing.detail.otherComputer')

  return app.placedAt
    ? t('apps.pairing.detail.placed', {
        date: format.date(new Date(app.placedAt))
      })
    : undefined
}
