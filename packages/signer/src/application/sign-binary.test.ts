import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterAll, describe, expect, it } from 'vitest'

import {
  ErrorCode,
  fixedClock,
  IPAForgeError,
  isPlistDict,
  parseXmlPlist,
  silentLogger,
  toHex
} from '@ipaforge/kernel'
import { readFixture } from '@signer/__tests__/fixtures.ts'
import {
  createTestIdentity,
  type TestIdentity
} from '@signer/__tests__/identity.ts'
import { type SignedTarget, signedTargets } from '@signer/__tests__/targets.ts'
import { signBinary } from '@signer/application/sign-binary.ts'
import type {
  EntitlementsInput,
  SigningMode
} from '@signer/application/types.ts'
import { parseMachO } from '@signer/domain/macho/parse.ts'
import { createHasher } from '@signer/infrastructure/hashing/index.ts'

const hasher = createHasher()
const deps = {
  hasher,
  logger: silentLogger,
  clock: fixedClock(new Date('2026-10-13T12:00:00Z'))
}
const isMac = process.platform === 'darwin'
const temp = mkdtempSync(join(tmpdir(), 'ipaforge-signbinary-'))
afterAll(() => rmSync(temp, { recursive: true, force: true }))

const loadEntitlements = (path: string): EntitlementsInput => {
  const bytes = readFixture(path)
  const dict = parseXmlPlist(bytes)
  if (!isPlistDict(dict)) throw new Error('entitlements must be a dict')
  return { bytes, dict }
}

/** Test certificates are not Apple-issued, so pin the anchor instead of "anchor apple generic". */
const testSigning = async (identity: TestIdentity): Promise<SigningMode> => {
  const anchorSha1 = await hasher.digest('sha1', identity.certificate)

  return {
    kind: 'identity',
    identity,
    teamId: identity.teamId,
    requirement: (identifier) => ({
      kind: 'anchor-hash',
      identifier,
      anchorSha1
    })
  }
}

/** Every meaningful byte of a signed file: each slice up to the end of its SuperBlob. */
const meaningfulBytes = (bytes: Uint8Array): string[] =>
  parseMachO(bytes).slices.map((slice) => {
    const sig = slice.codeSignature
    if (!sig) return toHex(slice.bytes)
    const view = new DataView(
      slice.bytes.buffer,
      slice.bytes.byteOffset + sig.dataoff + 4,
      4
    )

    return toHex(slice.bytes.subarray(0, sig.dataoff + view.getUint32(0)))
  })

describe.each(signedTargets().map((t) => [t.label, t] as const))(
  'signBinary(%s) ad-hoc',
  (_label, target: SignedTarget) => {
    it('reproduces Apple codesign byte-for-byte', async () => {
      const result = await signBinary(
        readFixture('inputs', ...target.binary),
        {
          identifier: target.identifier,
          signing: { kind: 'adhoc' },
          ...(target.entitlements
            ? { entitlements: loadEntitlements(target.entitlements) }
            : {}),
          ...(target.infoPlist
            ? { infoPlist: readFixture('expected', ...target.infoPlist) }
            : {}),
          ...(target.codeResources
            ? {
                codeResources: readFixture('expected', ...target.codeResources)
              }
            : {})
        },
        deps
      )
      const apple = readFixture('expected', ...target.binary)
      expect(result.bytes.byteLength).toBe(apple.byteLength)
      expect(meaningfulBytes(result.bytes)).toEqual(meaningfulBytes(apple))
      expect(result.cdhashes.every((hash) => hash.byteLength === 20)).toBe(true)
    })
  }
)

describe('signBinary with a certificate', () => {
  it
    .skipIf(!isMac)
    .each([
      'thin-min10',
      'thin-min14',
      'thin-min16',
      'fat',
      'resign',
      'nosig.dylib'
    ])('%s passes Apple `codesign --verify --strict`', async (name) => {
    const identity = await createTestIdentity()
    const result = await signBinary(
      readFixture('inputs', name),
      {
        identifier: `com.ipaforge.test.${name}`,
        signing: await testSigning(identity),
        ...(name.endsWith('.dylib')
          ? {}
          : { entitlements: loadEntitlements('entitlements/app.plist') })
      },
      deps
    )
    const path = join(temp, name)
    writeFileSync(path, result.bytes)
    const verify = execFileSync(
      'codesign',
      ['--verify', '--strict', '-vvv', path],
      {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe']
      }
    )
    expect(verify).toBe('')
  })

  it('writes the team ID into every slice', async () => {
    const identity = await createTestIdentity({ teamId: 'QQQQQ11111' })
    const result = await signBinary(
      readFixture('inputs', 'fat'),
      {
        identifier: 'com.ipaforge.fat',
        signing: { kind: 'identity', identity, teamId: identity.teamId }
      },
      deps
    )
    for (const slice of parseMachO(result.bytes).slices) {
      expect(new TextDecoder('latin1').decode(slice.bytes)).toContain(
        'QQQQQ11111\0'
      )
    }
  })
})

describe('signBinary refusals', () => {
  it('refuses FairPlay-encrypted binaries', async () => {
    const bytes = readFixture('inputs', 'thin-min14').slice()
    const slice = parseMachO(bytes).slices[0]
    if (!slice) throw new Error('fixture')
    // append a real LC_ENCRYPTION_INFO_64 { cryptoff, cryptsize, cryptid = 1, pad }
    const view = new DataView(bytes.buffer)
    const at = slice.headerSize + slice.sizeofcmds
    view.setUint32(at, 0x2c, true)
    view.setUint32(at + 4, 24, true)
    view.setUint32(at + 16, 1, true)
    view.setUint32(16, slice.ncmds + 1, true)
    view.setUint32(20, slice.sizeofcmds + 24, true)

    await expect(
      signBinary(bytes, { identifier: 'x', signing: { kind: 'adhoc' } }, deps)
    ).rejects.toMatchObject({
      code: ErrorCode.EncryptedBinary
    })
  })

  it('honours an aborted signal', async () => {
    const controller = new AbortController()
    controller.abort()
    await expect(
      signBinary(
        readFixture('inputs', 'thin-min14'),
        {
          identifier: 'x',
          signing: { kind: 'adhoc' },
          signal: controller.signal
        },
        deps
      )
    ).rejects.toThrow()
  })

  it('rejects non-Mach-O input with an IPAForgeError', async () => {
    await expect(
      signBinary(
        new Uint8Array(64),
        { identifier: 'x', signing: { kind: 'adhoc' } },
        deps
      )
    ).rejects.toBeInstanceOf(IPAForgeError)
  })
})
