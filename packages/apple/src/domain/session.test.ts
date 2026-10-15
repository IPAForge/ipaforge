import { describe, expect, it } from 'vitest'

import { secondFactorFromStatus } from '@apple/domain/session.ts'
import { ErrorCode } from '@loadstar/kernel'

describe('second factor from the GSA status', () => {
  it.each([
    [
      { au: 'trustedDeviceSecondaryAuth' },
      { kind: 'trusted_device', codeAlreadySent: false }
    ],
    [
      { au: 'trustedDeviceSecondaryAuth', hsc: 409 },
      { kind: 'trusted_device', codeAlreadySent: true }
    ],
    [{ hsc: 409 }, { kind: 'trusted_device', codeAlreadySent: true }],
    [{ au: 'secondaryAuth' }, { kind: 'sms', codeAlreadySent: false }],
    [{ au: 'repair' }, undefined],
    [{ hsc: 200 }, undefined],
    [{}, undefined]
  ])('%j → %j', (status, expected) =>
    expect(secondFactorFromStatus(status)).toEqual(expected)
  )

  it('reports an unknown step instead of treating it as signed in', () => {
    expect(() => secondFactorFromStatus({ au: 'somethingNew' })).toThrow(
      expect.objectContaining({ code: ErrorCode.TwoFactorUnsupported })
    )
  })
})
