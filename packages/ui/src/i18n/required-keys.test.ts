import { describe, expect, it } from 'vitest'

import { ErrorCode } from '@loadstar/kernel'
import { RecoveryAction, StepLabel } from '@loadstar/rpc'
import { createTestI18n } from '@ui/__tests__/test-i18n.ts'
import { shippedLanguages } from '@ui/i18n/languages/languages.ts'
import {
  errorBodyKey,
  errorTitleKey,
  recoveryKey
} from '@ui/i18n/required-keys.ts'

// The type-level check in required-keys.ts already fails typecheck for English; this also covers every
// shipped language, so a translation can't silently fall back for an error, a recovery action or a step.
const requiredKeys = [
  ...Object.values(ErrorCode).flatMap((code) => [
    errorTitleKey(code),
    errorBodyKey(code)
  ]),
  ...Object.values(RecoveryAction).map(recoveryKey),
  ...Object.values(StepLabel)
]

describe.each(shippedLanguages)('%s', (language) => {
  it('has a message for every error code, recovery action and step label', async () => {
    const i18n = await createTestI18n(language)
    const missing = requiredKeys.filter(
      (key) => !i18n.exists(key, { lng: language, fallbackLng: [] })
    )
    expect(missing).toEqual([])
  })
})
