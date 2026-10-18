// Keys the Engine's data needs: every ErrorCode, recovery action and step label must have English text.
// The assertions at the bottom make a missing one a type error that names the key.
import type { ErrorCode } from '@ipaforge/kernel'
import type { RecoveryAction } from '@ipaforge/rpc'
import type { TranslationKey } from '@ui/i18n/setup/types.ts'
import type { MissingKeys } from '@ui/i18n/types.ts'

export const errorTitleKey = (code: ErrorCode) =>
  `errors.${code}.title` as const
export const errorBodyKey = (code: ErrorCode) => `errors.${code}.body` as const
export const recoveryKey = (action: RecoveryAction) =>
  `recovery.${action}` as const

/** Guards the check below: if keys weren't typed, `TranslationKey` would be `string` and every key would "exist". */
export const translationKeysAreTyped: string extends TranslationKey
  ? never
  : true = true
/** A type error here lists the keys `en.json` lacks. */
export const requiredKeysPresent: [MissingKeys] extends [never]
  ? true
  : `missing in en.json: ${MissingKeys}` = true
