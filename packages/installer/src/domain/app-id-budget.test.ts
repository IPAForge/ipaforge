import { describe, expect, it } from 'vitest'

import { assertAppIdBudget } from '@installer/domain/app-id-budget.ts'
import { ErrorCode } from '@ipaforge/kernel'

const plan = (isUnreliable?: boolean) => ({
  reuse: [],
  create: ['com.example.app.TEAM'],
  available: 0,
  enough: false,
  ...(isUnreliable ? { isUnreliable } : {})
})

describe('assertAppIdBudget', () => {
  it('stops when there are none left, saying when the count was unreliable', () => {
    expect(() => assertAppIdBudget(plan(true))).toThrow(
      expect.objectContaining({
        code: ErrorCode.AppIdQuotaExceeded,
        data: expect.objectContaining({ unreliable: true })
      })
    )
  })

  it('goes on when asked to try anyway, but only when the count was unreliable', () => {
    expect(() => assertAppIdBudget(plan(true), true)).not.toThrow()
    expect(() => assertAppIdBudget(plan(), true)).toThrow(
      expect.objectContaining({ code: ErrorCode.AppIdQuotaExceeded })
    )
  })
})
