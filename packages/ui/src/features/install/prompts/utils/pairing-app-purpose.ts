import { pairingAppPurposeKeys } from '@ui/features/install/prompts/constants.ts'

/** The words for what a known app does with the pairing file; undefined for an app Loadstar doesn't know. */
export const pairingAppPurposeKey = (bundleId: string) =>
  Object.hasOwn(pairingAppPurposeKeys, bundleId)
    ? pairingAppPurposeKeys[bundleId as keyof typeof pairingAppPurposeKeys]
    : undefined
