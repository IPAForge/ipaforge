import { execFileSync } from 'node:child_process'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import {
  bytesFileSource,
  concatBytes,
  ErrorCode,
  fixedClock,
  LoadstarError,
  silentLogger,
  toHex
} from '@loadstar/kernel'
import { FIXTURES_DIR, readTree } from '@signer/__tests__/fixtures.ts'
import {
  createTestIdentity,
  type TestIdentity
} from '@signer/__tests__/identity.ts'
import { makeProfile } from '@signer/__tests__/profile.ts'
import {
  type BundleTree,
  createHasher,
  embeddedEntitlements,
  readIpa,
  type SignerProgress,
  type SigningMode,
  signIpa,
  writeIpa
} from '@signer/index.ts'

const isMac = process.platform === 'darwin'
const hasher = createHasher()
const now = new Date('2026-10-13T12:00:00Z')
const deps = { logger: silentLogger, clock: fixedClock(now), hasher }
const TEAM = 'ABCDE12345'
const temp = mkdtempSync(join(tmpdir(), 'loadstar-signipa-'))
afterAll(() => rmSync(temp, { recursive: true, force: true }))

let identity: TestIdentity
let signing: SigningMode
beforeAll(async () => {
  identity = await createTestIdentity({ teamId: TEAM })
  const anchorSha1 = await hasher.digest('sha1', identity.certificate)
  signing = {
    kind: 'identity',
    identity,
    teamId: TEAM,
    requirement: (identifier) => ({
      kind: 'anchor-hash',
      identifier,
      anchorSha1
    })
  }
})

/** A development profile for `bundleId`, issued to the test identity. */
const profileFor = (bundleId: string) =>
  makeProfile(identity, {
    teamId: TEAM,
    bundleId,
    certificates: [identity.certificate]
  })

const collect = async (
  stream: ReadableStream<Uint8Array>
): Promise<Uint8Array> => {
  const chunks: Uint8Array[] = []
  for await (const chunk of stream) chunks.push(chunk)
  return concatBytes(chunks)
}

const fixtureIpa = async (): Promise<Uint8Array> => {
  const app: BundleTree = new Map(
    readTree(join(FIXTURES_DIR, 'expected/Test.app')).map((e) => [
      e.path,
      e.kind === 'symlink'
        ? { kind: 'symlink' as const, target: e.target ?? '', mode: 0o755 }
        : {
            kind: 'file' as const,
            data: e.data ?? new Uint8Array(),
            mode: e.mode
          }
    ])
  )

  return collect(
    writeIpa(
      { appName: 'Test.app', app, extras: new Map() },
      { logger: silentLogger }
    )
  )
}

/** Extract with macOS ditto and run Apple's deep, strict verification. */
const verifyWithApple = (ipa: Uint8Array, name: string, app: string): void => {
  const dir = join(temp, name)
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'app.ipa'), ipa)
  execFileSync('ditto', ['-x', '-k', join(dir, 'app.ipa'), join(dir, 'out')])
  execFileSync(
    'codesign',
    ['--verify', '--deep', '--strict', join(dir, 'out', 'Payload', app)],
    { stdio: 'pipe' }
  )
}

describe('signIpa', () => {
  it("re-signs in place, keeping each executable's entitlements, and reports progress in order", async () => {
    const progress: SignerProgress[] = []
    const result = await signIpa(
      bytesFileSource('Test.ipa', await fixtureIpa()),
      { signing, onProgress: (event) => progress.push(event) },
      deps
    )
    const output = await collect(result.ipa)

    expect(progress.map((p) => p.stage)).toEqual([
      'reading',
      'signing',
      'signing',
      'signing',
      'signing',
      'writing'
    ])
    expect(result.summary.bundles.map((b) => b.identifier)).toEqual([
      'com.loadstar.fixture.lib',
      'com.loadstar.fixture.app.ext',
      'com.loadstar.fixture.app'
    ])

    const reread = await readIpa(bytesFileSource('out.ipa', output), {
      logger: silentLogger
    })
    const appEntitlements = embeddedEntitlements(
      (reread.app.get('Test') as { data: Uint8Array }).data
    )
    expect(toHex(appEntitlements?.bytes ?? new Uint8Array())).toBe(
      toHex(readFileSync(join(FIXTURES_DIR, 'entitlements/app.plist')))
    )
    if (isMac) verifyWithApple(output, 'inplace', 'Test.app')
  })

  it('prepares for sideloading: new IDs, profiles embedded, Apple-verifiable', async () => {
    const newMain = `com.loadstar.fixture.app.${TEAM}`
    const result = await signIpa(
      bytesFileSource('Test.ipa', await fixtureIpa()),
      {
        signing,
        sideload: {
          teamId: TEAM,
          newMainBundleId: newMain,
          certificate: identity.certificate,
          profiles: new Map([
            [newMain, await profileFor(newMain)],
            [`${newMain}.ext`, await profileFor(`${newMain}.ext`)]
          ])
        }
      },
      deps
    )
    expect(result.summary.bundles.map((b) => b.identifier)).toContain(
      `${newMain}.ext`
    )
    expect(result.app.app.get('embedded.mobileprovision')).toBeDefined()
    const output = await collect(result.ipa)
    if (isMac) verifyWithApple(output, 'sideload', 'Test.app')
  })

  it('stops with internal.aborted when cancelled mid-signing', async () => {
    const controller = new AbortController()
    const promise = signIpa(
      bytesFileSource('Test.ipa', await fixtureIpa()),
      {
        signing: { kind: 'adhoc' },
        signal: controller.signal,
        onProgress: (event) => {
          if (event.stage === 'signing') controller.abort()
        }
      },
      deps
    )
    await expect(promise).rejects.toMatchObject({ code: ErrorCode.Aborted })
  })

  it('wraps unreadable input in a LoadstarError', async () => {
    await expect(
      signIpa(
        bytesFileSource('x.ipa', new Uint8Array(100)),
        { signing: { kind: 'adhoc' } },
        deps
      )
    ).rejects.toBeInstanceOf(LoadstarError)
  })
})

// ---- real-world end to end: SideStore 0.7.0-alpha (opt-in, downloads ~28 MB once) ----------------

const SIDESTORE = {
  url: 'https://github.com/SideStore/SideStore/releases/download/0.7.0-alpha/SideStore.ipa',
  sha256: 'e334f86e6ceeab2e0d886c07611246533f474bb18838cf13ebc09ed1f0d622b5',
  cache: join(
    import.meta.dirname,
    '../../../../.cache/e2e/SideStore-0.7.0-alpha.ipa'
  )
}

const loadSideStore = async (): Promise<Uint8Array> => {
  if (!existsSync(SIDESTORE.cache)) {
    const response = await fetch(SIDESTORE.url)
    if (!response.ok)
      throw new Error(`download failed: HTTP ${response.status}`)
    mkdirSync(join(SIDESTORE.cache, '..'), { recursive: true })
    writeFileSync(SIDESTORE.cache, new Uint8Array(await response.arrayBuffer()))
  }
  const bytes = new Uint8Array(readFileSync(SIDESTORE.cache))
  const digest = toHex(await hasher.digest('sha256', bytes))
  if (digest !== SIDESTORE.sha256)
    throw new Error(`SideStore IPA checksum mismatch: ${digest}`)
  return bytes
}

describe.skipIf(!process.env.LOADSTAR_E2E)(
  'SideStore end to end (LOADSTAR_E2E=1)',
  () => {
    it('sideload-signs the real SideStore IPA into something Apple verifies', async () => {
      const bytes = await loadSideStore()
      const newMain = `com.SideStore.SideStore.${TEAM}`
      const started = performance.now()
      const result = await signIpa(
        bytesFileSource('SideStore.ipa', bytes),
        {
          signing,
          sideload: {
            teamId: TEAM,
            newMainBundleId: newMain,
            certificate: identity.certificate,
            profiles: new Map([
              [newMain, await profileFor(newMain)],
              [`${newMain}.AltWidget`, await profileFor(`${newMain}.AltWidget`)]
            ]),
            appGroups: new Map([
              ['group.com.SideStore.SideStore', `group.${newMain}`]
            ])
          }
        },
        deps
      )
      const output = await collect(result.ipa)
      console.info(
        `[e2e] SideStore signed in ${(performance.now() - started).toFixed(0)} ms: ` +
          `${result.summary.bundles.length} bundles, ${result.summary.looseBinaries} loose binaries, ${(output.length / 1024 / 1024).toFixed(1)} MB`
      )
      expect(result.summary.bundles.map((b) => b.identifier)).toEqual([
        'com.github.krzyzanowskim.OpenSSL',
        `${newMain}.AltWidget`,
        newMain
      ])
      if (isMac) verifyWithApple(output, 'sidestore', 'SideStore.app')
    }, 120_000)
  }
)
