import { describe, expect, it } from 'vitest'

import {
  DEFAULT_CODE_LENGTH,
  LEGACY_CODE_LENGTH,
  twoFactorMethods
} from '@apple/domain/two-factor.ts'

const phone = { id: 1, number: '+1 ••12' }

describe('twoFactorMethods', () => {
  it("offers the trusted device when GSA asked for it, with Apple's code length", () => {
    expect(
      twoFactorMethods(
        {
          legacy: false,
          phones: [phone],
          codeLength: 6,
          hasSecurityKeys: false
        },
        'trusted_device'
      )
    ).toEqual({
      trustedDevice: true,
      phones: [phone],
      codeLength: 6,
      legacy: false,
      securityKeysOnly: false
    })
  })

  it('falls back to the default or legacy code length', () => {
    expect(
      twoFactorMethods(
        { legacy: false, phones: [], hasSecurityKeys: false },
        'sms'
      ).codeLength
    ).toBe(DEFAULT_CODE_LENGTH)
    const legacy = twoFactorMethods(
      { legacy: true, phones: [], hasSecurityKeys: false },
      'sms'
    )
    expect(legacy.codeLength).toBe(LEGACY_CODE_LENGTH)
    expect(legacy.trustedDevice).toBe(true)
  })

  it('is security-keys-only only when no phone is available', () => {
    expect(
      twoFactorMethods(
        { legacy: false, phones: [], hasSecurityKeys: true },
        'sms'
      ).securityKeysOnly
    ).toBe(true)
    expect(
      twoFactorMethods(
        { legacy: false, phones: [phone], hasSecurityKeys: true },
        'sms'
      ).securityKeysOnly
    ).toBe(false)
  })
})
