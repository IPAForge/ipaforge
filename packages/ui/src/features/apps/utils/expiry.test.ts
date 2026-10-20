import { describe, expect, it } from 'vitest'

import {
  calendarDaysLeft,
  daysLeft,
  expiryTone
} from '@ui/features/apps/utils/expiry.ts'
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

/** Local time, as the device's clock shows it. */
const at = (day: number, hour: number, minute = 0) =>
  new Date(2026, 9, day, hour, minute)

describe('calendarDaysLeft', () => {
  it('says 7 for a 7-day profile made a minute ago, as SideStore does', () => {
    expect(calendarDaysLeft(at(27, 11, 53), at(20, 11, 54))).toBe(7)
  })

  it('counts calendar days, not hours: late tonight to early next week', () => {
    expect(calendarDaysLeft(at(26, 1), at(20, 23))).toBe(6)
  })

  it('says 0 for one ending later today, and negative days once past', () => {
    expect(calendarDaysLeft(at(20, 22), at(20, 9))).toBe(0)
    expect(calendarDaysLeft(at(18, 22), at(20, 9))).toBe(-2)
  })

  it('is unknown without an expiry', () => {
    expect(calendarDaysLeft(undefined, at(20, 9))).toBeUndefined()
  })
})
