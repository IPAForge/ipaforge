import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import * as asn1js from 'asn1js'
import * as pkijs from 'pkijs'
import { afterAll, describe, expect, it } from 'vitest'

import { compareBytes, fromBase64, toHex, utf8Decode } from '@loadstar/kernel'
import { readFixture } from '@signer/__tests__/fixtures.ts'
import { createTestIdentity } from '@signer/__tests__/identity.ts'
import {
  CSSLOT_ALTERNATE_CODEDIRECTORIES,
  CSSLOT_CODEDIRECTORY,
  findBlob,
  parseSuperBlob
} from '@signer/domain/blobs/index.ts'
import { parseMachO } from '@signer/domain/macho/parse.ts'
import { toArrayBuffer } from '@signer/infrastructure/cms/certificate.ts'
import {
  APPLE_CERTIFICATES,
  certificateInfo,
  parseCertificate,
  signCodeDirectories
} from '@signer/infrastructure/cms/index.ts'
import {
  OID_APPLE_CDHASHES,
  OID_APPLE_CDHASHES2,
  OID_CONTENT_TYPE,
  OID_MESSAGE_DIGEST,
  OID_SHA256_WITH_RSA,
  OID_SIGNING_TIME
} from '@signer/infrastructure/cms/oids.ts'
import { createHasher } from '@signer/infrastructure/hashing/index.ts'

const hasher = createHasher()
/** Starting the external openssl process is slow on Windows CI runners. */
const EXTERNAL_TOOL_TIMEOUT_MS = 30_000
const signingTime = new Date('2026-10-13T12:00:00Z')
const hasOpenssl = (() => {
  try {
    execFileSync('openssl', ['version'])
    return true
  } catch {
    return false
  }
})()

const codeDirectoriesOf = (fixture: string) => {
  const slice = parseMachO(readFixture('expected', fixture)).slices[0]
  const sig = slice?.codeSignature
  if (!slice || !sig) throw new Error('fixture')
  const blobs = parseSuperBlob(
    slice.bytes.subarray(sig.dataoff, sig.dataoff + sig.datasize)
  )
  const primary = findBlob(blobs, CSSLOT_CODEDIRECTORY)
  const alternate = findBlob(blobs, CSSLOT_ALTERNATE_CODEDIRECTORIES)
  if (!primary) throw new Error('fixture has no CD')
  return alternate
    ? [
        { bytes: primary, algorithm: 'sha1' as const },
        { bytes: alternate, algorithm: 'sha256' as const }
      ]
    : [{ bytes: primary, algorithm: 'sha256' as const }]
}

const signerInfoOf = (cms: Uint8Array): pkijs.SignerInfo => {
  const contentInfo = pkijs.ContentInfo.fromBER(toArrayBuffer(cms))
  const signed = new pkijs.SignedData({ schema: contentInfo.content })
  const info = signed.signerInfos[0]
  if (!info) throw new Error('no signer')
  return info
}

const temp = mkdtempSync(join(tmpdir(), 'loadstar-cms-'))
afterAll(() => rmSync(temp, { recursive: true, force: true }))

describe('Apple certificate bundle', () => {
  it.each(APPLE_CERTIFICATES.map((c) => [c.name, c] as const))(
    '%s matches its SHA-256 pin',
    async (_name, cert) => {
      const der = fromBase64(cert.der)
      expect(toHex(await hasher.digest('sha256', der))).toBe(cert.sha256)
    }
  )

  it('has every intermediate verifiably signed by a bundled root', async () => {
    const roots = APPLE_CERTIFICATES.filter((c) => c.kind === 'root').map((c) =>
      parseCertificate(fromBase64(c.der))
    )
    for (const cert of APPLE_CERTIFICATES.filter(
      (c) => c.kind === 'intermediate'
    )) {
      const intermediate = parseCertificate(fromBase64(cert.der))
      const verified = await Promise.all(
        roots.map((root) => intermediate.verify(root).catch(() => false))
      )
      expect({ name: cert.name, verified: verified.some(Boolean) }).toEqual({
        name: cert.name,
        verified: true
      })
    }
  })

  it('reads the team ID from the subject OU', async () => {
    const info = certificateInfo(
      (await createTestIdentity({ teamId: 'XYZ9876543' })).certificate
    )
    expect(info.organizationalUnit).toBe('XYZ9876543')
    expect(info.commonName).toBe(
      'Apple Development: Loadstar Test (XYZ9876543)'
    )
  })
})

describe.each(['thin-min14', 'thin-min10'])(
  'CMS over the %s CodeDirectories',
  (fixture) => {
    const cds = codeDirectoriesOf(fixture)

    it('verifies with pkijs and is deterministic for a fixed signing time', async () => {
      const identity = await createTestIdentity()
      const cms = await signCodeDirectories(cds, identity, signingTime, hasher)
      expect(
        toHex(await signCodeDirectories(cds, identity, signingTime, hasher))
      ).toBe(toHex(cms))

      const contentInfo = pkijs.ContentInfo.fromBER(toArrayBuffer(cms))
      const signed = new pkijs.SignedData({ schema: contentInfo.content })
      const primary = cds[0]?.bytes ?? new Uint8Array()
      const ok = await signed.verify({
        signer: 0,
        data: primary.buffer.slice(
          primary.byteOffset,
          primary.byteOffset + primary.byteLength
        ) as ArrayBuffer,
        checkChain: false
      })
      expect(ok).toBe(true)
      expect(signed.encapContentInfo.eContent).toBeUndefined() // detached
    })

    it("carries DER-sorted attributes with Apple's cdhash payloads", async () => {
      const cms = await signCodeDirectories(
        cds,
        await createTestIdentity(),
        signingTime,
        hasher
      )
      const attributes = signerInfoOf(cms).signedAttrs?.attributes ?? []
      const encodings = attributes.map(
        (a) => new Uint8Array(a.toSchema().toBER(false))
      )
      for (let i = 1; i < encodings.length; i++) {
        expect(
          compareBytes(
            encodings[i - 1] as Uint8Array,
            encodings[i] as Uint8Array
          )
        ).toBeLessThan(0)
      }
      expect(new Set(attributes.map((a) => a.type))).toEqual(
        new Set([
          OID_CONTENT_TYPE,
          OID_SIGNING_TIME,
          OID_MESSAGE_DIGEST,
          OID_APPLE_CDHASHES2,
          OID_APPLE_CDHASHES
        ])
      )

      const v2 = attributes.find((a) => a.type === OID_APPLE_CDHASHES2)
      expect(v2?.values).toHaveLength(cds.length) // one entry per CD actually present
      const octets = (type: string): Uint8Array => {
        const value = attributes.find((a) => a.type === type)?.values[0] as
          | asn1js.OctetString
          | undefined
        if (!value) throw new Error(`missing attribute ${type}`)
        return new Uint8Array(value.valueBlock.valueHexView)
      }
      const plist = utf8Decode(octets(OID_APPLE_CDHASHES))
      expect(plist.match(/<data>/g)).toHaveLength(cds.length)
      if (cds.length === 1)
        expect(new TextEncoder().encode(plist)).toHaveLength(278)

      const expected = await hasher.digest(
        'sha256',
        cds[0]?.bytes ?? new Uint8Array()
      )
      expect(toHex(octets(OID_MESSAGE_DIGEST))).toBe(toHex(expected))
    })

    it("matches Apple's CMS shape: DER-sorted certificates and an explicit NULL for sha256WithRSA", async () => {
      const identity = await createTestIdentity()
      const intermediate = fromBase64(
        APPLE_CERTIFICATES.find((c) => c.name === 'Apple WWDR CA G3')?.der ?? ''
      )
      const root = fromBase64(
        APPLE_CERTIFICATES.find((c) => c.name === 'Apple Root CA')?.der ?? ''
      )
      const cms = await signCodeDirectories(
        cds,
        { ...identity, chain: [intermediate, root] },
        signingTime,
        hasher
      )
      const signed = new pkijs.SignedData({
        schema: pkijs.ContentInfo.fromBER(toArrayBuffer(cms)).content
      })

      const encoded = (signed.certificates ?? []).map(
        (c) =>
          new Uint8Array((c as pkijs.Certificate).toSchema(true).toBER(false))
      )
      expect(encoded).toHaveLength(3)
      for (let i = 1; i < encoded.length; i++) {
        expect(
          compareBytes(encoded[i - 1] as Uint8Array, encoded[i] as Uint8Array)
        ).toBeLessThan(0)
      }

      const algorithm = signed.signerInfos[0]?.signatureAlgorithm
      expect(algorithm?.algorithmId).toBe(OID_SHA256_WITH_RSA)
      expect(algorithm?.algorithmParams).toBeInstanceOf(asn1js.Null)
      // still verifies after the parameter is made explicit
      const primary = cds[0]?.bytes ?? new Uint8Array()
      expect(
        await signed.verify({
          signer: 0,
          data: toArrayBuffer(primary),
          checkChain: false
        })
      ).toBe(true)
    })

    it.skipIf(!hasOpenssl)(
      'verifies with openssl cms (detached content)',
      { timeout: EXTERNAL_TOOL_TIMEOUT_MS },
      async () => {
        const identity = await createTestIdentity()
        const cms = await signCodeDirectories(
          cds,
          identity,
          signingTime,
          hasher
        )
        const dir = mkdtempSync(join(temp, `${fixture}-`))
        writeFileSync(join(dir, 'cms.der'), cms)
        writeFileSync(join(dir, 'cd.bin'), cds[0]?.bytes ?? new Uint8Array())
        writeFileSync(join(dir, 'leaf.pem'), identity.pem)
        const out = execFileSync(
          'openssl',
          [
            'cms',
            '-verify',
            '-binary',
            '-inform',
            'DER',
            '-in',
            'cms.der',
            '-content',
            'cd.bin',
            '-CAfile',
            'leaf.pem',
            '-purpose',
            'any',
            '-out',
            'verified.bin'
          ],
          { cwd: dir, stdio: ['ignore', 'pipe', 'pipe'] }
        )
        expect(out.toString()).toBe('')
      }
    )
  }
)
