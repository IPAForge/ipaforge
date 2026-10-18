import { describe, expect, it } from 'vitest'

import { ErrorCode } from '@ipaforge/kernel'
import { planSideloadIdentity } from '@signer/domain/sideload/identity-plan.ts'
import type { IpaInspection } from '@signer/domain/sideload/types.ts'

const TEAM = 'ABCDE12345'
const MAIN = 'com.example.app'

const inspection = (overrides: Partial<IpaInspection> = {}): IpaInspection => ({
  app: {
    path: 'Payload/Example.app',
    identifier: MAIN,
    name: 'Example',
    version: '1.0',
    deviceFamilies: [1],
    architectures: ['arm64']
  },
  nested: [
    {
      path: 'Extensions/Kit.appex',
      kind: 'appex',
      identifier: `${MAIN}.kit`,
      name: 'Kit'
    },
    {
      path: 'PlugIns/Widget.appex',
      kind: 'appex',
      identifier: `${MAIN}.widget`,
      name: 'Widget'
    },
    {
      path: 'Watch/Watch.app',
      kind: 'watch-app',
      identifier: `${MAIN}.watchkitapp`,
      name: 'Watch'
    }
  ],
  appGroups: [],
  keychainAccessGroups: [],
  altAppGroups: [],
  ...overrides
})

describe('planSideloadIdentity', () => {
  it('names the main app <orig>.<TEAMID> and keeps every nested suffix, main app first', () => {
    const plan = planSideloadIdentity(inspection(), TEAM)
    expect(plan.newMainBundleId).toBe(`${MAIN}.${TEAM}`)
    expect(plan.bundles).toEqual([
      { identifier: `${MAIN}.${TEAM}`, name: 'Example' },
      { identifier: `${MAIN}.${TEAM}.kit`, name: 'Kit' },
      { identifier: `${MAIN}.${TEAM}.widget`, name: 'Widget' },
      { identifier: `${MAIN}.${TEAM}.watchkitapp`, name: 'Watch' }
    ])
  })

  it('plans no app group when the app declares none', () => {
    const plan = planSideloadIdentity(inspection(), TEAM)
    expect(plan.appGroup).toBeUndefined()
    expect('appGroup' in plan).toBe(false)
    expect(plan.appGroups.size).toBe(0)
  })

  it('maps every declared group (entitlements and ALTAppGroups) to group.<newMainId>', () => {
    const plan = planSideloadIdentity(
      inspection({
        appGroups: ['group.com.example.app', 'group.com.example.shared'],
        altAppGroups: ['group.com.example.app']
      }),
      TEAM
    )
    const group = `group.${MAIN}.${TEAM}`
    expect(plan.appGroup).toBe(group)
    expect([...plan.appGroups]).toEqual([
      ['group.com.example.app', group],
      ['group.com.example.shared', group]
    ])
  })

  it('plans an app group from ALTAppGroups alone', () => {
    expect(
      planSideloadIdentity(inspection({ altAppGroups: ['group.legacy'] }), TEAM)
        .appGroup
    ).toBe(`group.${MAIN}.${TEAM}`)
  })

  it("refuses a nested bundle outside the app's ID", () => {
    const stray = inspection({
      nested: [
        {
          path: 'PlugIns/X.appex',
          kind: 'appex',
          identifier: 'com.elsewhere.x',
          name: 'X'
        }
      ]
    })
    expect(() => planSideloadIdentity(stray, TEAM)).toThrow(
      expect.objectContaining({ code: ErrorCode.ExtensionPrefix })
    )
  })
})
