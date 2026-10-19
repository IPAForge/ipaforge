import { describe, expect, it } from 'vitest'

import { daysLeft, expiryTone } from '@ui/features/apps/utils/expiry.ts'
import { isNewerVersion } from '@ui/features/apps/utils/is-newer-version.ts'

const NOW = new Date('2026-10-19T10:00:00Z')

describe('expiry', () => {
  it('counts the days left, negative once expired', () => {
    expect(daysLeft(new Date('2026-10-21T10:00:00Z'), NOW)).toBe(2)
    expect(daysLeft(new Date('2026-10-18T10:00:00Z'), NOW)).toBe(-1)
    expect(daysLeft(undefined, NOW)).toBeUndefined()
  })

  it('is fine, soon (inside the refresh window), expired or unknown', () => {
    expect(expiryTone(5, 2)).toBe('ok')
    expect(expiryTone(2, 2)).toBe('soon')
    expect(expiryTone(0, 2)).toBe('expired')
    expect(expiryTone(undefined, 2)).toBe('unknown')
  })
})

describe('isNewerVersion', () => {
  it('compares version numbers in order', () => {
    expect(isNewerVersion('2.10.0', '2.9.1')).toBe(true)
    expect(isNewerVersion('2.1.3-nightly.20261019', '2.1.2')).toBe(true)
    expect(isNewerVersion('2.4.0', '2.4')).toBe(false)
    expect(isNewerVersion('1.0', '1.0.1')).toBe(false)
    expect(isNewerVersion('beta', '1.0')).toBe(false)
  })
})
