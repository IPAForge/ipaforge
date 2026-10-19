import { describe, expect, it } from 'vitest'

import { createDict, type PlistValue } from '@ipaforge/kernel'
import { concreteKeychainGroups } from '@signer/domain/entitlements/keychain-groups.ts'

const NEW_TEAM = 'NEWTEAM123'
const OLD_TEAM = 'OLDTEAM456'
const SHARED = 'com.example.container.shared'

const profile = (...groups: string[]) =>
  createDict([['keychain-access-groups', groups]])
const executable = (
  groups: readonly string[],
  extra: readonly [string, PlistValue][] = []
) =>
  createDict([
    ['com.apple.developer.team-identifier', OLD_TEAM],
    ['keychain-access-groups', [...groups]],
    ...extra
  ])
const numbered = (prefix: string, count: number): string[] =>
  Array.from({ length: count }, (_, i) => `${prefix}${SHARED}.${i + 1}`)

describe('concreteKeychainGroups', () => {
  it('moves the declared groups to the new team when the profile grants TEAMID.*', () => {
    const declared = [`${OLD_TEAM}.${SHARED}`, ...numbered(`${OLD_TEAM}.`, 127)]
    const result = concreteKeychainGroups(
      profile(`${NEW_TEAM}.*`),
      executable(declared),
      NEW_TEAM
    )
    expect(result?.groups).toEqual([
      `${NEW_TEAM}.${SHARED}`,
      ...numbered(`${NEW_TEAM}.`, 127)
    ])
    expect(result?.dropped).toEqual([])
  })

  it("moves an extension's groups too when it doesn't name its team (LiveContainer's LiveProcess)", () => {
    // LiveProcess.appex in LiveContainer 3.8.0: the main app's shared groups, but no application-identifier and no
    // team-identifier of its own. The old team comes from the groups themselves.
    const declared = [`${OLD_TEAM}.${SHARED}`, ...numbered(`${OLD_TEAM}.`, 127)]
    const result = concreteKeychainGroups(
      profile(`${NEW_TEAM}.*`),
      createDict([['keychain-access-groups', declared]]),
      NEW_TEAM
    )

    expect(result?.groups).toEqual([
      `${NEW_TEAM}.${SHARED}`,
      ...numbered(`${NEW_TEAM}.`, 127)
    ])
    expect(result?.dropped).toEqual([])
  })

  it('expands an unexpanded $(AppIdentifierPrefix)', () => {
    const result = concreteKeychainGroups(
      profile(`${NEW_TEAM}.*`),
      createDict([
        ['keychain-access-groups', [`$(AppIdentifierPrefix)${SHARED}`]]
      ]),
      NEW_TEAM
    )
    expect(result?.groups).toEqual([`${NEW_TEAM}.${SHARED}`])
  })

  it('takes the old team from application-identifier when there is no team identifier', () => {
    const original = createDict([
      ['application-identifier', `${OLD_TEAM}.com.example.app`],
      ['keychain-access-groups', [`${OLD_TEAM}.${SHARED}`]]
    ])
    expect(
      concreteKeychainGroups(profile(`${NEW_TEAM}.*`), original, NEW_TEAM)
        ?.groups
    ).toEqual([`${NEW_TEAM}.${SHARED}`])
  })

  it("keeps only the groups the profile's patterns allow and reports the rest", () => {
    const declared = [
      `${OLD_TEAM}.${SHARED}`,
      `${OLD_TEAM}.com.other.group`,
      'ZZZZZ99999.com.foreign'
    ]
    const result = concreteKeychainGroups(
      profile(`${NEW_TEAM}.com.example.*`),
      executable(declared),
      NEW_TEAM
    )
    expect(result?.groups).toEqual([`${NEW_TEAM}.${SHARED}`])
    expect(result?.dropped).toEqual([
      `${OLD_TEAM}.com.other.group`,
      'ZZZZZ99999.com.foreign'
    ])
  })

  it("falls back to the profile's value when no declared group is allowed", () => {
    const result = concreteKeychainGroups(
      profile(`${NEW_TEAM}.*`),
      executable(['com.unprefixed.group']),
      NEW_TEAM
    )
    expect(result).toEqual({
      groups: [`${NEW_TEAM}.*`],
      dropped: ['com.unprefixed.group']
    })
  })

  it('does nothing without a wildcard grant or without declared groups', () => {
    const declared = executable([`${OLD_TEAM}.${SHARED}`])
    expect(
      concreteKeychainGroups(
        profile(`${NEW_TEAM}.${SHARED}`),
        declared,
        NEW_TEAM
      )
    ).toBeUndefined()
    expect(
      concreteKeychainGroups(createDict(), declared, NEW_TEAM)
    ).toBeUndefined()
    expect(
      concreteKeychainGroups(profile(`${NEW_TEAM}.*`), executable([]), NEW_TEAM)
    ).toBeUndefined()
    expect(
      concreteKeychainGroups(profile(`${NEW_TEAM}.*`), undefined, NEW_TEAM)
    ).toBeUndefined()
  })
})
