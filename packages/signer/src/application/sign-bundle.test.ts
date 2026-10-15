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

import { afterAll, describe, expect, it } from 'vitest'

import {
  fixedClock,
  isPlistDict,
  parseXmlPlist,
  silentLogger,
  toHex
} from '@loadstar/kernel'
import {
  FIXTURES_DIR,
  readFixture,
  readTree
} from '@signer/__tests__/fixtures.ts'
import { createTestIdentity } from '@signer/__tests__/identity.ts'
import {
  canonicalIdentifier,
  type SignBundleProgress,
  signBundle
} from '@signer/application/sign-bundle.ts'
import type {
  EntitlementsInput,
  SigningMode
} from '@signer/application/signing.ts'
import type { BundleTree } from '@signer/domain/bundle/tree.ts'
import { createHasher } from '@signer/infrastructure/hashing/index.ts'

const hasher = createHasher()
const deps = {
  hasher,
  logger: silentLogger,
  clock: fixedClock(new Date('2026-10-13T12:00:00Z'))
}
const isMac = process.platform === 'darwin'
const temp = mkdtempSync(join(tmpdir(), 'loadstar-signbundle-'))
afterAll(() => rmSync(temp, { recursive: true, force: true }))

const loadTree = (root: string): BundleTree =>
  new Map(
    readTree(join(FIXTURES_DIR, root)).map((e) => [
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

const loadEntitlements = (path: string): EntitlementsInput => {
  const bytes = readFixture(path)
  const dict = parseXmlPlist(bytes)
  if (!isPlistDict(dict)) throw new Error('entitlements must be a dict')
  return { bytes, dict }
}

const entitlementsFor = (kind: string): EntitlementsInput | undefined =>
  kind === 'app'
    ? loadEntitlements('entitlements/app.plist')
    : kind === 'appex'
      ? loadEntitlements('entitlements/appex.plist')
      : undefined

const writeTree = (tree: BundleTree, root: string): void => {
  for (const [path, entry] of tree) {
    const target = join(root, path)
    mkdirSync(dirname(target), { recursive: true })
    if (entry.kind === 'symlink') symlinkSync(entry.target, target)
    else writeFileSync(target, entry.data, { mode: entry.mode })
  }
}

describe('signBundle (ad-hoc) on Test.app', () => {
  it("reproduces Apple codesign's output tree file-for-file", async () => {
    const tree = loadTree('inputs/Test.app')
    const progress: SignBundleProgress[] = []
    const summary = await signBundle(
      tree,
      {
        configFor: (bundle) => {
          const entitlements = entitlementsFor(bundle.kind)

          return {
            signing: { kind: 'adhoc' },
            ...(entitlements ? { entitlements } : {})
          }
        },
        onProgress: (event) => progress.push(event)
      },
      deps
    )

    const expected = loadTree('expected/Test.app')
    expect([...tree.keys()].sort()).toEqual([...expected.keys()].sort())
    for (const [path, entry] of expected) {
      const ours = tree.get(path)
      if (entry.kind === 'symlink')
        expect(ours).toMatchObject({ kind: 'symlink', target: entry.target })
      else
        expect({
          path,
          hex: ours?.kind === 'file' ? toHex(ours.data) : ''
        }).toEqual({ path, hex: toHex(entry.data) })
    }

    // order: framework, appex (deepest/alphabetical), then the main app's loose dylib, then the app
    expect(progress.map((p) => p.path)).toEqual([
      'Frameworks/Lib.framework',
      'PlugIns/Ext.appex',
      'Frameworks/libloose.dylib',
      ''
    ])
    expect(summary.bundles.map((b) => b.identifier)).toEqual([
      'com.loadstar.fixture.lib',
      'com.loadstar.fixture.app.ext',
      'com.loadstar.fixture.app'
    ])
    expect(summary.looseBinaries).toBe(1)
  })

  it('removes stale signatures before re-signing an already signed bundle', async () => {
    const tree = loadTree('expected/Test.app')
    tree.set('SC_Info/Test.sinf', {
      kind: 'file',
      data: new Uint8Array([1]),
      mode: 0o644
    })
    await signBundle(
      tree,
      {
        configFor: (bundle) => {
          const entitlements = entitlementsFor(bundle.kind)

          return {
            signing: { kind: 'adhoc' },
            ...(entitlements ? { entitlements } : {})
          }
        }
      },
      deps
    )
    expect([...tree.keys()].some((path) => path.startsWith('SC_Info/'))).toBe(
      false
    )
    expect(tree.get('_CodeSignature/CodeResources')).toBeDefined()
  })
})

describe('signBundle with a certificate', () => {
  it.skipIf(!isMac)(
    'produces a bundle Apple verifies with --deep --strict, profiles embedded',
    async () => {
      const identity = await createTestIdentity()
      const anchorSha1 = await hasher.digest('sha1', identity.certificate)
      const signing: SigningMode = {
        kind: 'identity',
        identity,
        teamId: identity.teamId,
        requirement: (identifier) => ({
          kind: 'anchor-hash',
          identifier,
          anchorSha1
        })
      }
      const tree = loadTree('inputs/Test.app')
      tree.delete('embedded.mobileprovision')
      await signBundle(
        tree,
        {
          configFor: (bundle) => {
            const entitlements = entitlementsFor(bundle.kind)

            return {
              signing,
              ...(entitlements ? { entitlements } : {}),
              ...(bundle.kind === 'framework'
                ? {}
                : {
                    provisioningProfile: new TextEncoder().encode(
                      `profile:${bundle.identifier}`
                    )
                  })
            }
          }
        },
        deps
      )
      expect(
        new TextDecoder().decode(
          (
            tree.get('PlugIns/Ext.appex/embedded.mobileprovision') as {
              data: Uint8Array
            }
          ).data
        )
      ).toBe('profile:com.loadstar.fixture.app.ext')

      const root = join(temp, 'Test.app')
      writeTree(tree, root)
      const out = execFileSync(
        'codesign',
        ['--verify', '--deep', '--strict', '-vvv', root],
        {
          encoding: 'utf8',
          stdio: ['ignore', 'pipe', 'pipe']
        }
      )
      expect(out).toBe('')
    }
  )
})

describe('canonicalIdentifier', () => {
  it.each([
    ['Frameworks/libloose.dylib', 'libloose'],
    ['libz.1.2.dylib', 'libz.1.2'],
    ['helper', 'helper'],
    ['libfoo.1', 'libfoo.1']
  ])('%s → %s', (path, expected) => {
    expect(canonicalIdentifier(path)).toBe(expected)
  })
})
