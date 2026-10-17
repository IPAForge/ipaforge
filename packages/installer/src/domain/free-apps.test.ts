import { describe, expect, it } from 'vitest'

import {
  freeProfileBundleIds,
  isFreeProfile,
  needsFreeSlot,
  occupiedFreeSlots,
  profilesOf
} from '@installer/domain/free-apps.ts'
import type { ProfileFacts } from '@installer/domain/types.ts'

const DAY = 24 * 60 * 60 * 1000
const rules = { freeTeamIds: new Set(['FREE']), maxLifetimeMs: 8 * DAY }
const created = new Date('2026-10-01T00:00:00Z')
const lasting = (days: number) => ({
  createdAt: created,
  expiresAt: new Date(created.getTime() + days * DAY)
})

const facts = (
  uuid: string,
  teamId: string,
  bundleId: string,
  extra: Partial<ProfileFacts> = {}
): ProfileFacts => ({
  uuid,
  teamId,
  applicationIdentifier: `${teamId}.${bundleId}`,
  ...extra
})

describe('free-app counting', () => {
  it("treats the account's free team, and any 7-day profile, as free; paid profiles are not", () => {
    expect(isFreeProfile(facts('1', 'FREE', 'a'), rules)).toBe(true)
    expect(isFreeProfile(facts('2', 'OTHER', 'a', lasting(7)), rules)).toBe(
      true
    )
    expect(isFreeProfile(facts('3', 'PAID', 'a', lasting(365)), rules)).toBe(
      false
    )
    expect(isFreeProfile(facts('4', 'UNKNOWN', 'a'), rules)).toBe(false)
  })

  it('collects the bundle IDs of free profiles, skipping wildcards', () => {
    const profiles = [
      facts('1', 'FREE', 'com.a'),
      facts('2', 'FREE', '*'),
      facts('3', 'PAID', 'com.p', lasting(365))
    ]
    expect([...freeProfileBundleIds(profiles, rules)]).toEqual(['com.a'])
  })

  it('counts installed free-profile apps, leaving out the app being reinstalled', () => {
    const free = new Set(['com.a', 'com.b', 'com.gone', 'com.self'])
    const installed = new Map([
      ['com.a', { name: 'A' }],
      ['com.b', {}],
      ['com.self', {}],
      ['com.paid', {}]
    ])
    const occupied = occupiedFreeSlots(free, installed, 'com.self')
    expect(occupied).toEqual([
      { bundleId: 'com.a', name: 'A' },
      { bundleId: 'com.b' }
    ])
    expect(needsFreeSlot(occupied, 3)).toBe(false)
    expect(
      needsFreeSlot(occupiedFreeSlots(free, installed, 'com.new'), 3)
    ).toBe(true)
  })

  it("finds an app's profiles and its extensions' profiles, not a look-alike's", () => {
    const profiles = [
      facts('1', 'T', 'com.a'),
      facts('2', 'T', 'com.a.widget'),
      facts('3', 'T', 'com.ab')
    ]
    expect(profilesOf(profiles, 'com.a')).toEqual(['1', '2'])
  })
})
