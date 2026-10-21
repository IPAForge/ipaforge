import type { AppPairing } from '@ui/services/engine/types.ts'

/** A pairing app that can't reach the device by itself: no pairing file, or no (or a refused) remote one. */
export const needsPairing = (app: AppPairing): boolean =>
  app.kind === 'known' &&
  (app.classic === 'missing' ||
    app.remote === 'missing' ||
    app.remote === 'rejected')
