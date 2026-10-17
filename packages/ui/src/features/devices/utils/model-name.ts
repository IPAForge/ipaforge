import { modelNames } from '@ui/features/devices/constants.ts'

/** The name people know a model by ("iPhone 15 Pro"), or Apple's identifier ("iPhone16,1") for one not listed. */
export const modelName = (productType: string): string =>
  Object.hasOwn(modelNames, productType)
    ? (modelNames[productType] ?? productType)
    : productType
