import { beforeAll, describe, expect, it } from 'vitest'

import {
  createDict,
  ErrorCode,
  type PlistValue,
  silentLogger
} from '@loadstar/kernel'
import {
  addBundle,
  fileAt,
  fixtureAppTree,
  infoAt,
  SAMPLE_EXECUTABLE,
  setFile,
  withEntitlements
} from '@signer/__tests__/app-tree.ts'
import {
  createTestIdentity,
  type TestIdentity
} from '@signer/__tests__/identity.ts'
import { makeProfile } from '@signer/__tests__/profile.ts'
import { reconcileForSideload } from '@signer/application/reconcile.ts'
import type { ReconcileOptions } from '@signer/application/types.ts'
import type { BundleTree } from '@signer/domain/bundle/types.ts'

const now = new Date('2026-10-13T12:00:00Z')
const TEAM = 'ABCDE12345'
const OLD_TEAM = 'OLDTEAM456'
const OLD = 'com.loadstar.fixture.app'
const NEW = `${OLD}.${TEAM}`
const GROUP = `group.${NEW}`
const SHARED = 'com.loadstar.fixture.shared'

const KIT = 'Extensions/Kit.appex'
const WATCH = 'Watch/W.app'
const WATCH_EXT = 'Watch/W.app/PlugIns/X.appex'
const NESTED = ['PlugIns/Ext.appex', KIT, WATCH, WATCH_EXT]

let identity: TestIdentity
beforeAll(async () => {
  identity = await createTestIdentity({ teamId: TEAM })
})

/** The fixture app plus an ExtensionKit extension and a watch app with its own extension. */
const nestedTree = (): BundleTree => {
  const tree = fixtureAppTree()
  addBundle(tree, KIT, [['CFBundleIdentifier', `${OLD}.kit`]])
  addBundle(tree, WATCH, [
    ['CFBundleIdentifier', `${OLD}.watchkitapp`],
    ['WKCompanionAppBundleIdentifier', OLD]
  ])
  addBundle(tree, WATCH_EXT, [
    ['CFBundleIdentifier', `${OLD}.watchkitapp.ext`],
    [
      'NSExtension',
      createDict([
        [
          'NSExtensionAttributes',
          createDict([['WKAppBundleIdentifier', `${OLD}.watchkitapp`]])
        ]
      ])
    ]
  ])
  return tree
}

const profileFor = (
  bundleId: string,
  extraEntitlements: readonly [string, PlistValue][] = []
) =>
  makeProfile(identity, {
    teamId: TEAM,
    bundleId,
    certificates: [identity.certificate],
    extraEntitlements
  })

const options = async (
  profileEntitlements: readonly [string, PlistValue][] = [],
  ids: readonly string[] = [
    NEW,
    `${NEW}.ext`,
    `${NEW}.kit`,
    `${NEW}.watchkitapp`,
    `${NEW}.watchkitapp.ext`
  ]
): Promise<ReconcileOptions> => ({
  teamId: TEAM,
  newMainBundleId: NEW,
  certificate: identity.certificate,
  now,
  appGroups: new Map([[`group.${OLD}`, GROUP]]),
  profiles: new Map(
    await Promise.all(
      ids.map(
        async (id) => [id, await profileFor(id, profileEntitlements)] as const
      )
    )
  )
})

describe('reconcileForSideload with Extensions/ and Watch/', () => {
  it('gives every nested bundle its new ID and rewrites the watch keys', async () => {
    const tree = nestedTree()
    const result = reconcileForSideload(tree, await options(), silentLogger)

    expect([...result.provisioning.keys()].sort()).toEqual(
      ['', ...NESTED].sort()
    )
    expect(infoAt(tree, KIT).CFBundleIdentifier).toBe(`${NEW}.kit`)
    expect(infoAt(tree, WATCH).CFBundleIdentifier).toBe(`${NEW}.watchkitapp`)
    expect(infoAt(tree, WATCH).WKCompanionAppBundleIdentifier).toBe(NEW)
    expect(infoAt(tree, WATCH_EXT).CFBundleIdentifier).toBe(
      `${NEW}.watchkitapp.ext`
    )
    expect(infoAt(tree, WATCH_EXT).NSExtension).toEqual(
      createDict([
        [
          'NSExtensionAttributes',
          createDict([['WKAppBundleIdentifier', `${NEW}.watchkitapp`]])
        ]
      ])
    )
    expect(
      result.provisioning.get(WATCH_EXT)?.entitlements.dict[
        'application-identifier'
      ]
    ).toBe(`${TEAM}.${NEW}.watchkitapp.ext`)
  })

  it("lists the app's ALTAppGroups in every nested bundle", async () => {
    const tree = nestedTree()
    reconcileForSideload(tree, await options(), silentLogger)
    expect(infoAt(tree, '').ALTAppGroups).toEqual([GROUP])
    for (const path of NESTED)
      expect(infoAt(tree, path).ALTAppGroups).toEqual([GROUP])
    expect(
      infoAt(tree, 'Frameworks/Lib.framework').ALTAppGroups
    ).toBeUndefined()
  })

  it("refuses a watch extension outside the app's ID", async () => {
    const tree = nestedTree()
    addBundle(tree, WATCH_EXT, [
      ['CFBundleIdentifier', 'com.elsewhere.watch.ext']
    ])
    await expect(async () =>
      reconcileForSideload(tree, await options(), silentLogger)
    ).rejects.toMatchObject({
      code: ErrorCode.ExtensionPrefix
    })
  })

  it('prunes a whole watch app, including its extension, when it has no profile', async () => {
    const tree = nestedTree()
    const onlyPhone = await options([], [NEW, `${NEW}.ext`, `${NEW}.kit`])
    const result = reconcileForSideload(
      tree,
      { ...onlyPhone, pruneUnprovisioned: true },
      silentLogger
    )
    expect(result.pruned).toEqual([WATCH_EXT, WATCH])
    expect([...tree.keys()].some((path) => path.startsWith('Watch/'))).toBe(
      false
    )
  })
})

describe('keychain access groups', () => {
  const declared = [
    `${OLD_TEAM}.${SHARED}`,
    `${OLD_TEAM}.${SHARED}.1`,
    `${OLD_TEAM}.${SHARED}.2`
  ]

  /** The fixture app whose main executable and extension were signed with concrete keychain groups. */
  const signedTree = async (): Promise<BundleTree> => {
    const tree = fixtureAppTree()
    const entitlements = createDict([
      ['application-identifier', `${OLD_TEAM}.${OLD}`],
      ['com.apple.developer.team-identifier', OLD_TEAM],
      ['keychain-access-groups', declared]
    ])
    setFile(
      tree,
      'Test',
      await withEntitlements(fileAt(tree, 'Test'), entitlements),
      0o755
    )
    setFile(
      tree,
      SAMPLE_EXECUTABLE,
      await withEntitlements(fileAt(tree, SAMPLE_EXECUTABLE), entitlements),
      0o755
    )
    return tree
  }
  const keychainOf = (
    result: ReturnType<typeof reconcileForSideload>,
    path: string
  ) =>
    result.provisioning.get(path)?.entitlements.dict['keychain-access-groups']

  it('signs the main app and its extension with the concrete groups under the new team', async () => {
    const result = reconcileForSideload(
      await signedTree(),
      await options([], [NEW, `${NEW}.ext`]),
      silentLogger
    )
    const concrete = declared.map((group) => group.replace(OLD_TEAM, TEAM))
    expect(keychainOf(result, '')).toEqual(concrete)
    expect(keychainOf(result, 'PlugIns/Ext.appex')).toEqual(concrete)
  })

  it("drops groups the profile's patterns do not allow, and warns", async () => {
    const warnings: unknown[] = []
    const logger = {
      ...silentLogger,
      warn: (message: string, fields?: unknown) =>
        warnings.push([message, fields])
    }
    const narrow = await options(
      [['keychain-access-groups', [`${TEAM}.${SHARED}.1*`]]],
      [NEW, `${NEW}.ext`]
    )
    const result = reconcileForSideload(await signedTree(), narrow, logger)
    expect(keychainOf(result, '')).toEqual([`${TEAM}.${SHARED}.1`])
    expect(warnings).toContainEqual([
      'keychain access groups not allowed by the profile were dropped',
      {
        bundleId: NEW,
        groups: [`${OLD_TEAM}.${SHARED}`, `${OLD_TEAM}.${SHARED}.2`]
      }
    ])
  })

  it("keeps the profile's value when the profile has no wildcard or the executable declares no groups", async () => {
    const exact = await options(
      [['keychain-access-groups', [`${TEAM}.${SHARED}`]]],
      [NEW, `${NEW}.ext`]
    )
    expect(
      keychainOf(
        reconcileForSideload(await signedTree(), exact, silentLogger),
        ''
      )
    ).toEqual([`${TEAM}.${SHARED}`])

    const unsigned = reconcileForSideload(
      fixtureAppTree(),
      await options([], [NEW, `${NEW}.ext`]),
      silentLogger
    )
    expect(keychainOf(unsigned, '')).toEqual([`${TEAM}.*`])
  })
})
