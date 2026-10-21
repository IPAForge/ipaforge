import type { pairingPlaceKeys } from '@ui/features/apps/constants.ts'
import type { AppPairing } from '@ui/services/engine/types.ts'

/** Place for a known app without a file, Place again once it has one, Add… for an app of your own without one. */
export const placeKind = (app: AppPairing): keyof typeof pairingPlaceKeys => {
  if (app.classic !== 'missing') return 'again'

  return app.kind === 'own' ? 'add' : 'place'
}
