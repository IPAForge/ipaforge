import type { DeviceKind } from '@ui/features/devices/types.ts'

/** An Apple TV or Apple Vision Pro by its model identifier (`AppleTV14,1`, `RealityDevice14,1`); none for the rest. */
export const deviceKind = (
  productType: string | undefined
): DeviceKind | undefined => {
  if (productType?.startsWith('AppleTV')) return 'tv'
  if (productType?.startsWith('RealityDevice')) return 'vision'
  return undefined
}
