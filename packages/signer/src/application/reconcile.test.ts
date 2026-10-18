import { execFileSync } from 'node:child_process'
import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import {
  ErrorCode,
  fixedClock,
  type PlistDict,
  parsePlist,
  silentLogger,
  toHex,
  utf8Encode
} from '@ipaforge/kernel'
import { rejection } from '@signer/__tests__/errors.ts'
import { FIXTURES_DIR, readTree } from '@signer/__tests__/fixtures.ts'
import {
  createTestIdentity,
  type TestIdentity
} from '@signer/__tests__/identity.ts'
import {
  makeProfile,
  type TestProfileOptions
} from '@signer/__tests__/profile.ts'
import { reconcileForSideload } from '@signer/application/reconcile.ts'
import { signBundle } from '@signer/application/sign-bundle.ts'
import type { ReconcileOptions } from '@signer/application/types.ts'
import type { BundleTree } from '@signer/domain/bundle/types.ts'
import { createHasher } from '@signer/infrastructure/hashing/index.ts'
import {
  parseProvisioningProfile,
  profileCoversBundle
} from '@signer/infrastructure/profile/profile.ts'

const hasher = createHasher()
const now = new Date('2026-10-13T12:00:00Z')
const deps = { hasher, logger: silentLogger, clock: fixedClock(now) }
const isMac = process.platform === 'darwin'
const TEAM = 'ABCDE12345'
const NEW_MAIN = `com.ipaforge.fixture.app.${TEAM}`
const DEVICE = '00008110-000A1B2C3D4E5F60'
const temp = mkdtempSync(join(tmpdir(), 'ipaforge-reconcile-'))
afterAll(() => rmSync(temp, { recursive: true, force: true }))

let identity: TestIdentity
beforeAll(async () => {
  identity = await createTestIdentity({ teamId: TEAM })
})

const loadTree = (): BundleTree =>
  new Map(
    readTree(join(FIXTURES_DIR, 'inputs/Test.app')).map((e) => [
      e.path,
      e.kind === 'symlink'
        ? { kind: 'symlink' as const, target: e.target ?? '', mode: e.mode }
        : {
            kind: 'file' as const,
            data: e.data ?? new Uint8Array(),
            mode: e.mode
          }
    ])
  )

const profileFor = (
  bundleId: string,
  overrides: Partial<TestProfileOptions> = {}
) =>
  makeProfile(identity, {
    teamId: TEAM,
    bundleId,
    certificates: [identity.certificate],
    devices: [DEVICE],
    ...overrides
  })

const baseOptions = async (
  overrides: Partial<ReconcileOptions> = {}
): Promise<ReconcileOptions> => ({
  teamId: TEAM,
  newMainBundleId: NEW_MAIN,
  certificate: identity.certificate,
  deviceUdid: DEVICE,
  now,
  appGroups: new Map([
    ['group.com.ipaforge.fixture.app', `group.com.ipaforge.fixture.app.${TEAM}`]
  ]),
  profiles: new Map([
    [NEW_MAIN, await profileFor(NEW_MAIN)],
    [`${NEW_MAIN}.ext`, await profileFor(`${NEW_MAIN}.ext`)]
  ]),
  ...overrides
})

const infoOf = (tree: BundleTree, path: string): PlistDict => {
  const entry = tree.get(path)
  if (entry?.kind !== 'file') throw new Error(`missing ${path}`)
  return parsePlist(entry.data) as PlistDict
}

describe('provisioning profiles', () => {
  it("parses Apple's CMS envelope", async () => {
    const profile = parseProvisioningProfile(await profileFor(NEW_MAIN))
    expect(profile.teamId).toBe(TEAM)
    expect(profile.applicationIdentifier).toBe(`${TEAM}.${NEW_MAIN}`)
    expect(profile.provisionedDevices).toEqual([DEVICE])
    expect(toHex(profile.developerCertificates[0] ?? new Uint8Array())).toBe(
      toHex(identity.certificate)
    )
    expect(profile.expirationDate.toISOString()).toBe(
      '2026-10-20T00:00:00.000Z'
    )
  })

  it('falls back to the embedded XML when the envelope is not parseable CMS', async () => {
    const xml =
      new TextDecoder()
        .decode(await profileFor(NEW_MAIN))
        .match(/<\?xml[\s\S]*<\/plist>/)?.[0] ?? ''
    const raw = new Uint8Array([
      0x30,
      0x80,
      ...utf8Encode('junk'),
      ...utf8Encode(xml),
      0,
      0
    ])
    expect(parseProvisioningProfile(raw).teamId).toBe(TEAM)
  })

  it('matches wildcard application identifiers', async () => {
    const profile = parseProvisioningProfile(await profileFor('*'))
    expect(profileCoversBundle(profile, 'anything.at.all')).toBe(true)
    expect(
      profileCoversBundle(
        parseProvisioningProfile(await profileFor(NEW_MAIN)),
        'other'
      )
    ).toBe(false)
  })

  it('rejects garbage with signer.invalid_profile', async () => {
    expect(
      (
        await rejection(() =>
          parseProvisioningProfile(utf8Encode('not a profile'))
        )
      )?.code
    ).toBe(ErrorCode.InvalidProfile)
  })
})

describe('reconcileForSideload', () => {
  it("rewrites bundle IDs and identity keys, and takes entitlements from each bundle's own profile", async () => {
    const tree = loadTree()
    const frameworkInfoBefore = tree.get('Frameworks/Lib.framework/Info.plist')
    const result = reconcileForSideload(tree, await baseOptions(), silentLogger)

    const app = infoOf(tree, 'Info.plist')
    expect(app.CFBundleIdentifier).toBe(NEW_MAIN)
    expect(app.ALTAppGroups).toEqual([`group.com.ipaforge.fixture.app.${TEAM}`])
    expect(app.BGTaskSchedulerPermittedIdentifiers).toEqual([
      `${NEW_MAIN}.refresh`
    ])
    expect(app.LSApplicationQueriesSchemes).toEqual(['sidestore']) // untouched keys survive
    expect(
      infoOf(tree, 'PlugIns/Ext.appex/Info.plist').CFBundleIdentifier
    ).toBe(`${NEW_MAIN}.ext`)
    expect(tree.get('Frameworks/Lib.framework/Info.plist')).toBe(
      frameworkInfoBefore
    ) // frameworks keep theirs

    expect([...result.bundleIds]).toEqual([
      ['com.ipaforge.fixture.app', NEW_MAIN],
      ['com.ipaforge.fixture.app.ext', `${NEW_MAIN}.ext`]
    ])
    expect(
      result.provisioning.get('')?.entitlements.dict['application-identifier']
    ).toBe(`${TEAM}.${NEW_MAIN}`)
    expect(
      result.provisioning.get('PlugIns/Ext.appex')?.entitlements.dict[
        'application-identifier'
      ]
    ).toBe(`${TEAM}.${NEW_MAIN}.ext`)
  })

  it('makes wildcard application-identifiers concrete', async () => {
    const options = await baseOptions({
      profiles: new Map([
        [NEW_MAIN, await profileFor('*')],
        [`${NEW_MAIN}.ext`, await profileFor('*')]
      ])
    })
    const result = reconcileForSideload(loadTree(), options, silentLogger)
    expect(
      result.provisioning.get('PlugIns/Ext.appex')?.entitlements.dict[
        'application-identifier'
      ]
    ).toBe(`${TEAM}.${NEW_MAIN}.ext`)
  })

  it.each([
    [
      "another team's profile",
      { teamId: 'ZZZZZ99999' },
      ErrorCode.ProfileMismatch
    ],
    [
      'an expired profile',
      { expires: new Date('2026-10-01T00:00:00Z') },
      ErrorCode.ProfileExpired
    ],
    [
      'a profile without the certificate',
      { certificates: [] },
      ErrorCode.CertificateNotInProfile
    ],
    [
      'a profile without the device',
      { devices: ['00008110-FFFFFFFFFFFFFFFF'] },
      ErrorCode.DeviceNotProvisioned
    ],
    [
      'a profile for another app',
      { bundleId: 'com.other.app' },
      ErrorCode.ProfileMismatch
    ]
  ] as const)('refuses %s', async (_label, overrides, code) => {
    const options = await baseOptions({
      profiles: new Map([[NEW_MAIN, await profileFor(NEW_MAIN, overrides)]])
    })
    expect(
      (
        await rejection(() =>
          reconcileForSideload(loadTree(), options, silentLogger)
        )
      )?.code
    ).toBe(code)
  })

  it('fails when an extension has no profile, or prunes it on request', async () => {
    const onlyMain = await baseOptions({
      profiles: new Map([[NEW_MAIN, await profileFor(NEW_MAIN)]])
    })
    expect(
      (
        await rejection(() =>
          reconcileForSideload(loadTree(), onlyMain, silentLogger)
        )
      )?.code
    ).toBe(ErrorCode.ProfileMismatch)

    const tree = loadTree()
    const result = reconcileForSideload(
      tree,
      { ...onlyMain, pruneUnprovisioned: true },
      silentLogger
    )
    expect(result.pruned).toEqual(['PlugIns/Ext.appex'])
    expect(
      [...tree.keys()].some((path) => path.startsWith('PlugIns/Ext.appex'))
    ).toBe(false)
  })

  it("refuses extensions whose ID is not prefixed by the app's", async () => {
    const tree = loadTree()
    const info = new TextDecoder().decode(
      (tree.get('PlugIns/Ext.appex/Info.plist') as { data: Uint8Array }).data
    )
    tree.set('PlugIns/Ext.appex/Info.plist', {
      kind: 'file',
      mode: 0o644,
      data: utf8Encode(
        info.replace('com.ipaforge.fixture.app.ext', 'com.elsewhere.ext')
      )
    })
    expect(
      (
        await rejection(async () =>
          reconcileForSideload(tree, await baseOptions(), silentLogger)
        )
      )?.code
    ).toBe(ErrorCode.ExtensionPrefix)
  })
})

describe('reconcile + signBundle end to end', () => {
  it.skipIf(!isMac)(
    "yields an app Apple verifies, with each bundle's profile and entitlements",
    async () => {
      const tree = loadTree()
      const { provisioning } = reconcileForSideload(
        tree,
        await baseOptions(),
        silentLogger
      )
      const anchorSha1 = await hasher.digest('sha1', identity.certificate)

      await signBundle(
        tree,
        {
          configFor: (bundle) => {
            const p = provisioning.get(bundle.path)

            return {
              signing: {
                kind: 'identity',
                identity,
                teamId: TEAM,
                requirement: (identifier) => ({
                  kind: 'anchor-hash',
                  identifier,
                  anchorSha1
                })
              },
              ...(p
                ? {
                    entitlements: p.entitlements,
                    provisioningProfile: p.provisioningProfile
                  }
                : {})
            }
          }
        },
        deps
      )

      const root = join(temp, 'Test.app')
      for (const [path, entry] of tree) {
        const target = join(root, path)
        mkdirSync(dirname(target), { recursive: true })
        if (entry.kind === 'symlink') symlinkSync(entry.target, target)
        else writeFileSync(target, entry.data, { mode: entry.mode })
      }
      execFileSync('codesign', ['--verify', '--deep', '--strict', root], {
        stdio: ['ignore', 'pipe', 'pipe']
      })
      const appex = execFileSync(
        'codesign',
        ['-d', '--entitlements', ':-', join(root, 'PlugIns/Ext.appex')],
        {
          encoding: 'utf8',
          stdio: ['ignore', 'pipe', 'pipe']
        }
      )
      expect(appex).toContain(`${TEAM}.${NEW_MAIN}.ext`)
    }
  )
})
