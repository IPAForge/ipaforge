import type { StepLabel } from '@ipaforge/rpc'
import type {
  errorBodyKey,
  errorTitleKey,
  recoveryKey
} from '@ui/i18n/required-keys.ts'
import type { TranslationKey } from '@ui/i18n/setup/types.ts'

export type StepLabelKey = (typeof StepLabel)[keyof typeof StepLabel]

/** Every key the Engine's data needs: error titles and bodies, recovery actions and step labels. */
export type RequiredKey =
  | ReturnType<typeof errorTitleKey>
  | ReturnType<typeof errorBodyKey>
  | ReturnType<typeof recoveryKey>
  | StepLabelKey

/** `never` when `en.json` has every required key; otherwise the missing keys. */
export type MissingKeys = Exclude<RequiredKey, TranslationKey>
