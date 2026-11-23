import { describe, expect, it } from 'vitest'

import { ErrorCode } from '@ipaforge/kernel'
import { RecoveryAction, StepLabel } from '@ipaforge/rpc'
import { createTestI18n } from '@ui/__tests__/test-i18n.ts'
import { SOURCE_LANGUAGE } from '@ui/i18n/languages/languages.ts'
import {
  errorBodyKey,
  errorTitleKey,
  recoveryKey
} from '@ui/i18n/required-keys.ts'

// The type-level check in required-keys.ts already fails typecheck for English; this checks the same at run time, in
// English. Other languages may lack any of them: translations come from Weblate as they are done, and a missing
// message falls back to English (scripts/check-locales.ts reports how complete each language is).
const requiredKeys = [
  ...Object.values(ErrorCode).flatMap((code) => [
    errorTitleKey(code),
    errorBodyKey(code)
  ]),
  ...Object.values(RecoveryAction).map(recoveryKey),
  ...Object.values(StepLabel)
]

describe.each([SOURCE_LANGUAGE])('%s', (language) => {
  it('has a message for every error code, recovery action and step label', async () => {
    const i18n = await createTestI18n(language)
    const missing = requiredKeys.filter(
      (key) => !i18n.exists(key, { lng: language, fallbackLng: [] })
    )
    expect(missing).toEqual([])
  })
})
