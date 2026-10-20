import { describe, expect, it } from 'vitest'

import { recoveryFixes } from '@ui/features/install/recovery/utils/recovery-fixes.ts'

describe('recoveryFixes', () => {
  it('keeps the Engine’s order, first fix first', () => {
    expect(recoveryFixes(['wait-for-app-id-slot', 'switch-account'])).toEqual({
      first: 'wait-for-app-id-slot',
      others: ['switch-account']
    })
  })

  it('doesn’t offer Try again twice when the first fix already continues the run', () => {
    expect(recoveryFixes(['unlock-device', 'retry'])).toEqual({
      first: 'unlock-device',
      others: []
    })
    expect(recoveryFixes(['trust-computer', 'retry']).others).toEqual(['retry'])
  })

  it('leaves out fixes whose screen comes later', () => {
    expect(recoveryFixes(['choose-team', 'check-network', 'retry'])).toEqual({
      first: 'check-network',
      others: []
    })
    expect(recoveryFixes(['update-ipaforge', 'report-issue'])).toEqual({
      first: undefined,
      others: []
    })
  })
})

describe('anisette server failures', () => {
  it('first open the anisette servers in Settings, keeping Try again', () => {
    expect(
      recoveryFixes(['change-anisette-server', 'check-network', 'retry'])
    ).toEqual({
      first: 'change-anisette-server',
      others: ['check-network', 'retry']
    })
  })
})

describe('Try anyway', () => {
  const quota = [
    'wait-for-app-id-slot',
    'try-anyway',
    'switch-account'
  ] as const

  it("isn't offered when Apple's App ID count was real", () => {
    const { first, others } = recoveryFixes(quota, 'sidestore')

    expect([first, ...others]).not.toContain('try-anyway')
  })

  it('comes first when Apple reported a negative count', () => {
    expect(recoveryFixes(quota, 'sidestore', true).first).toBe('try-anyway')
  })
})
