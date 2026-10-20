import { describe, expect, it } from 'vitest'

import {
  repairOptions,
  repairPlan,
  repairStage
} from '@ui/features/repair/utils/repair-plan.ts'
import type { SideStoreHealth } from '@ui/services/engine/types.ts'

const NOW = new Date('2026-10-20T10:00:00Z')
const DAY_MS = 24 * 60 * 60 * 1000

const health = (changes: Partial<SideStoreHealth> = {}): SideStoreHealth => ({
  bundleId: 'com.SideStore.SideStore.TEAM',
  version: '0.7.0',
  latest: '0.7.0',
  channel: 'stable',
  signedBy: 'team',
  expiresAt: new Date(NOW.getTime() + 5 * DAY_MS),
  signing: 'valid',
  ownCertificate: 'valid',
  pairing: 'this-computer',
  remotePairing: 'accepted',
  ...changes
})

describe('repairPlan, remote pairing (iOS 17.4 and later)', () => {
  it('needs the pairing file when the device no longer accepts the remote pairing', () => {
    expect(
      repairPlan(health({ remotePairing: 'rejected' }), NOW).required
    ).toEqual(['pairing'])
  })

  it("offers it when there is none, or another computer's, since the classic pairing still works", () => {
    for (const remotePairing of ['missing', 'other-computer'] as const)
      expect(repairPlan(health({ remotePairing }), NOW)).toEqual({
        required: [],
        optional: ['pairing'],
        blocked: false
      })
  })

  it('needs nothing below iOS 17.4', () => {
    expect(repairPlan(health({ remotePairing: 'not-needed' }), NOW)).toEqual({
      required: [],
      optional: [],
      blocked: false
    })
  })
})

describe('repairPlan', () => {
  it('needs nothing for a sound SideStore', () => {
    expect(repairPlan(health(), NOW)).toEqual({
      required: [],
      optional: [],
      blocked: false
    })
  })

  it('needs a new profile and the pairing file when it expires and lost its file', () => {
    expect(
      repairPlan(
        health({
          expiresAt: new Date(NOW.getTime() - DAY_MS),
          pairing: 'missing'
        }),
        NOW
      ).required
    ).toEqual(['profile', 'pairing'])
  })

  it('installs it again when its certificate is gone, which covers the rest', () => {
    expect(
      repairPlan(
        health({
          ownCertificate: 'missing',
          expiresAt: new Date(NOW.getTime() - DAY_MS),
          pairing: 'other-computer'
        }),
        NOW
      )
    ).toEqual({ required: ['reinstall'], optional: [], blocked: false })
  })

  it("only offers what's a warning or can't be told", () => {
    expect(
      repairPlan(
        health({
          signing: 'unknown',
          ownCertificate: 'other',
          pairing: 'other-computer',
          version: '0.6.2'
        }),
        NOW
      )
    ).toEqual({
      required: [],
      optional: ['reinstall', 'pairing'],
      blocked: false
    })
  })

  it('never installs again over another team or Apple ID, but still places the pairing file', () => {
    const plan = repairPlan(
      health({
        signedBy: 'other-apple-id',
        signing: 'unknown',
        expiresAt: new Date(NOW.getTime() - DAY_MS),
        pairing: 'missing'
      }),
      NOW
    )

    expect(plan).toEqual({ required: ['pairing'], optional: [], blocked: true })
    expect(
      repairStage(
        { locked: false, developerMode: 'on', sideStore: health() },
        plan
      )
    ).toBe('plan')
  })
})

describe('repairOptions', () => {
  it('adds the picked offers, installing again covering the rest', () => {
    const plan = repairPlan(
      health({ pairing: 'missing', signing: 'unknown' }),
      NOW
    )

    expect(repairOptions('id', plan, [])).toEqual({
      bundleId: 'id',
      reinstall: false,
      profile: false,
      pairing: true
    })
    expect(repairOptions('id', plan, ['reinstall'])).toEqual({
      bundleId: 'id',
      reinstall: true,
      profile: false,
      pairing: false
    })
  })
})
