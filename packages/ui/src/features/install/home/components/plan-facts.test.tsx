import { describe, expect, it } from 'vitest'

import { t } from '@ui/__tests__/test-i18n.ts'

describe('the App IDs line', () => {
  it('says when every App ID the install needs is already registered', () => {
    expect(
      t('install.plan.appIdsValue', { created: 0, reused: 2, left: 7 })
    ).toBe('All 2 already registered · 7 left this week')
  })

  it('says how many are new, and how many reused', () => {
    expect(
      t('install.plan.appIdsValue', { created: 2, reused: 0, left: 8 })
    ).toBe('2 new · 8 left this week')
    expect(
      t('install.plan.appIdsValue', { created: 1, reused: 1, left: 9 })
    ).toBe('1 new, 1 reused · 9 left this week')
  })
})
