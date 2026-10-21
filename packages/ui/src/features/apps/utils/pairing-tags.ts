import {
  classicPairingTags,
  remotePairingTags
} from '@ui/features/apps/constants.ts'
import type { RowTag } from '@ui/features/developer/types.ts'
import type { AppPairing } from '@ui/services/engine/types.ts'

/** An app's pairing tags: a known app's classic (and remote) file by whose it is; an own app's only once placed. */
export const pairingTags = (app: AppPairing): RowTag[] => {
  if (app.kind === 'own')
    return app.classic === 'missing' ? [] : [classicPairingTags[app.classic]]

  return [
    classicPairingTags[app.classic],
    ...(app.remote ? [remotePairingTags[app.remote]] : [])
  ]
}
