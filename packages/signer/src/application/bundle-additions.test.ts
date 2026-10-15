import { describe, expect, it } from 'vitest'

import {
  createDict,
  ErrorCode,
  fixedClock,
  isPlistDict,
  type PlistDict,
  type PlistValue,
  parsePlist,
  serializeXmlPlist,
  silentLogger,
  toHex
} from '@loadstar/kernel'
import { createTestIdentity } from '@signer/__tests__/identity.ts'
import { fixtureIpaSource } from '@signer/__tests__/ipa.ts'
import { makeProfile } from '@signer/__tests__/profile.ts'
import {
  applyBundleAdditions,
  type BundleAdditions
} from '@signer/application/bundle-additions.ts'
import { signIpa } from '@signer/application/sign-ipa.ts'
import type { CodeBundle } from '@signer/domain/bundle/discover.ts'
import { type BundleTree, readFile } from '@signer/domain/bundle/tree.ts'
import { DEFAULT_SIGNER_LIMITS } from '@signer/domain/config.ts'
import { createHasher } from '@signer/infrastructure/hashing/index.ts'

const hasher = createHasher()
const context = { limits: DEFAULT_SIGNER_LIMITS, logger: silentLogger }
const payload = new TextEncoder().encode('added')

const file = (data: Uint8Array) => ({
  kind: 'file' as const,
  data,
  mode: 0o644
})
const infoPlist = (identifier: string): Uint8Array =>
  serializeXmlPlist(
    createDict([
      ['CFBundleExecutable', 'Exec'],
      ['CFBundleIdentifier', identifier]
    ])
  )

/** A minimal app with one framework (executables only need to exist for bundle discovery). */
const smallApp = (): BundleTree =>
  new Map([
    ['Info.plist', file(infoPlist('com.example.app.TEAM'))],
    ['Exec', file(new Uint8Array(1))],
    ['Frameworks/Kit.framework/Info.plist', file(infoPlist('com.example.kit'))],
    ['Frameworks/Kit.framework/Exec', file(new Uint8Array(1))]
  ])

const plistAt = (tree: BundleTree, path: string): PlistDict => {
  const value = parsePlist(readFile(tree, path) as Uint8Array)
  if (!isPlistDict(value)) throw new Error(`${path} is not a dict`)
  return value
}

const dictAt = (dict: PlistDict, key: string): PlistDict => {
  const value: PlistValue | undefined = dict[key]
  if (!isPlistDict(value)) throw new Error(`${key} is not a dict`)
  return value
}

/** `hash2` of `path` in a bundle's sealed CodeResources. */
const sealedHash = (
  tree: BundleTree,
  bundlePath: string,
  path: string
): string => {
  const prefix = bundlePath === '' ? '' : `${bundlePath}/`
  const entry = dictAt(
    dictAt(plistAt(tree, `${prefix}_CodeSignature/CodeResources`), 'files2'),
    path
  )

  return toHex(entry.hash2 as Uint8Array)
}

describe('applyBundleAdditions', () => {
  it('passes bundles with their original identifiers and writes files and Info.plist keys', () => {
    const tree = smallApp()
    const seen: string[] = []
    const plan: BundleAdditions = (bundles: readonly CodeBundle[]) => {
      seen.push(...bundles.map((bundle) => bundle.identifier))
      return [
        {
          bundlePath: 'Frameworks/Kit.framework',
          files: new Map([['Sub/added.bin', payload]]),
          infoPlist: createDict([['AddedKey', 'value']])
        }
      ]
    }

    applyBundleAdditions(tree, plan, {
      ...context,
      renamed: new Map([['com.example.app', 'com.example.app.TEAM']])
    })

    expect(seen).toEqual(['com.example.kit', 'com.example.app'])
    expect(readFile(tree, 'Frameworks/Kit.framework/Sub/added.bin')).toEqual(
      payload
    )
    const info = plistAt(tree, 'Frameworks/Kit.framework/Info.plist')
    expect(info.AddedKey).toBe('value')
    expect(info.CFBundleIdentifier).toBe('com.example.kit')
  })

  it('keeps earlier Info.plist changes when two additions target the same bundle', () => {
    const tree = smallApp()
    applyBundleAdditions(
      tree,
      () => [
        { bundlePath: '', infoPlist: createDict([['First', 1]]) },
        { bundlePath: '', infoPlist: createDict([['Second', 2]]) }
      ],
      context
    )
    expect(plistAt(tree, 'Info.plist')).toMatchObject({ First: 1, Second: 2 })
  })

  it.each(['../escape', '/absolute', 'a/../../b', 'a\\b', '', 'a//b', './a'])(
    'rejects the path %j',
    (path) => {
      const plan: BundleAdditions = () => [
        { bundlePath: '', files: new Map([[path, payload]]) }
      ]
      expect(() => applyBundleAdditions(smallApp(), plan, context)).toThrow(
        expect.objectContaining({ code: ErrorCode.InvalidBundle })
      )
    }
  )

  it('rejects a target that is not a code bundle', () => {
    const plan: BundleAdditions = () => [
      { bundlePath: 'Frameworks', files: new Map([['x', payload]]) }
    ]
    expect(() => applyBundleAdditions(smallApp(), plan, context)).toThrow(
      expect.objectContaining({ code: ErrorCode.InvalidBundle })
    )
  })

  it('does nothing without a plan', () => {
    const tree = smallApp()
    applyBundleAdditions(tree, undefined, context)
    expect([...tree.keys()]).toEqual([...smallApp().keys()])
  })
})

describe('signIpa with additions', () => {
  const deps = {
    logger: silentLogger,
    clock: fixedClock(new Date('2026-10-13T12:00:00Z')),
    hasher
  }
  const framework = 'Frameworks/Lib.framework'
  const additions: BundleAdditions = () => [
    {
      bundlePath: framework,
      files: new Map([['added.bin', payload]]),
      infoPlist: createDict([['AddedKey', 'x']])
    }
  ]

  it("seals added files in the bundle's CodeResources and in its parent's", async () => {
    const result = await signIpa(
      await fixtureIpaSource(),
      { signing: { kind: 'adhoc' }, additions },
      deps
    )
    const tree = result.app.app
    const expected = toHex(await hasher.digest('sha256', payload))

    expect(readFile(tree, `${framework}/added.bin`)).toEqual(payload)
    expect(plistAt(tree, `${framework}/Info.plist`).AddedKey).toBe('x')
    expect(sealedHash(tree, framework, 'added.bin')).toBe(expected)
    expect(sealedHash(tree, '', `${framework}/added.bin`)).toBe(expected)
  })

  it('sees original identifiers when the app is prepared for sideloading', async () => {
    const team = 'ABCDE12345'
    const identity = await createTestIdentity({ teamId: team })
    const newMain = `com.loadstar.fixture.app.${team}`
    const profile = (bundleId: string) =>
      makeProfile(identity, {
        teamId: team,
        bundleId,
        certificates: [identity.certificate]
      })
    const seen: string[] = []

    await signIpa(
      await fixtureIpaSource(),
      {
        signing: { kind: 'adhoc' },
        sideload: {
          teamId: team,
          newMainBundleId: newMain,
          certificate: identity.certificate,
          profiles: new Map([
            [newMain, await profile(newMain)],
            [`${newMain}.ext`, await profile(`${newMain}.ext`)]
          ])
        },
        additions: (bundles) => {
          seen.push(...bundles.map((bundle) => bundle.identifier))
          return []
        }
      },
      deps
    )
    expect(seen).toContain('com.loadstar.fixture.app')
    expect(seen).toContain('com.loadstar.fixture.app.ext')
  })
})
