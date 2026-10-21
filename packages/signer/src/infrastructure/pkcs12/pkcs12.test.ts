import { beforeAll, describe, expect, it } from 'vitest'

import { ErrorCode } from '@ipaforge/kernel'
import {
  createTestIdentity,
  type TestIdentity
} from '@signer/__tests__/identity.ts'
import { OID_DATA, OID_SHA1 } from '@signer/infrastructure/cms/oids.ts'
import {
  OID_CERT_BAG,
  OID_ENCRYPTED_DATA,
  OID_PBE_SHA1_3DES,
  OID_SHROUDED_KEY_BAG,
  PKCS12_ITERATIONS
} from '@signer/infrastructure/pkcs12/constants.ts'
import { forge } from '@signer/infrastructure/pkcs12/forge.ts'
import {
  exportPkcs12,
  importPkcs12,
  keyMatchesCertificate
} from '@signer/infrastructure/pkcs12/index.ts'
import type { Asn1 } from '@signer/infrastructure/pkcs12/types.ts'

const PASSWORD = '00000000-1111-2222-3333-444444444444'

const parse = (bytes: Uint8Array): Asn1 =>
  forge.asn1.fromDer(forge.util.binary.raw.encode(bytes))
const child = (node: Asn1, index: number): Asn1 =>
  (node.value as Asn1[])[index] as Asn1
const oidOf = (node: Asn1): string => forge.asn1.derToOid(node.value as string)
const integerOf = (node: Asn1): number =>
  forge.asn1.derToInteger(node.value as string)
/** The DER inside a ContentInfo's `[0] OCTET STRING`. */
const contentOf = (contentInfo: Asn1): Asn1 =>
  forge.asn1.fromDer(child(child(contentInfo, 1), 0).value as string)

let identity: TestIdentity
let privateKey: Uint8Array
let p12: Uint8Array
beforeAll(async () => {
  identity = await createTestIdentity()
  privateKey = new Uint8Array(
    await crypto.subtle.exportKey('pkcs8', identity.privateKey)
  )
  p12 = exportPkcs12({
    certificate: identity.certificate,
    privateKey,
    password: PASSWORD,
    friendlyName: 'IPAForge'
  })
})

describe('exportPkcs12', () => {
  it('round-trips through node-forge with the right password, and the key matches the certificate', () => {
    const pfx = forge.pkcs12.pkcs12FromAsn1(parse(p12), true, PASSWORD)
    const key = pfx.getBags({ bagType: OID_SHROUDED_KEY_BAG })[
      OID_SHROUDED_KEY_BAG
    ]?.[0]
    const cert = pfx.getBags({ bagType: OID_CERT_BAG })[OID_CERT_BAG]?.[0]

    expect(key?.key?.n.toString(16)).toBe(cert?.cert?.publicKey.n.toString(16))
    expect(cert?.attributes.friendlyName).toEqual(['IPAForge'])
    expect(key?.attributes.localKeyId).toEqual(cert?.attributes.localKeyId)
  })

  it('rejects the wrong password', () => {
    expect(() =>
      forge.pkcs12.pkcs12FromAsn1(parse(p12), true, 'wrong')
    ).toThrow()
  })

  it('uses the legacy algorithms iOS imports: 3DES bags and an HMAC-SHA1 MAC at 2048 iterations', () => {
    const pfx = parse(p12)
    const authenticatedSafe = contentOf(child(pfx, 1))
    const certificates = child(authenticatedSafe, 0)
    const keys = child(authenticatedSafe, 1)

    const encryptedData = child(child(certificates, 1), 0)
    const certificateAlgorithm = child(child(encryptedData, 1), 1)
    expect(oidOf(child(certificates, 0))).toBe(OID_ENCRYPTED_DATA)
    expect(oidOf(child(certificateAlgorithm, 0))).toBe(OID_PBE_SHA1_3DES)
    expect(integerOf(child(child(certificateAlgorithm, 1), 1))).toBe(
      PKCS12_ITERATIONS
    )

    const keyBag = child(contentOf(keys), 0)
    const keyAlgorithm = child(child(child(keyBag, 1), 0), 0)
    expect(oidOf(child(keys, 0))).toBe(OID_DATA)
    expect(oidOf(child(keyBag, 0))).toBe(OID_SHROUDED_KEY_BAG)
    expect(oidOf(child(keyAlgorithm, 0))).toBe(OID_PBE_SHA1_3DES)
    expect(integerOf(child(child(keyAlgorithm, 1), 1))).toBe(PKCS12_ITERATIONS)

    const mac = child(pfx, 2)
    expect(oidOf(child(child(child(mac, 0), 0), 0))).toBe(OID_SHA1)
    expect(integerOf(child(mac, 2))).toBe(PKCS12_ITERATIONS)
  })

  it('rejects input that is not a DER certificate or a DER key', () => {
    const certificate = identity.certificate
    const garbage = new Uint8Array([1, 2, 3])
    expect(() =>
      exportPkcs12({ certificate: garbage, privateKey, password: PASSWORD })
    ).toThrow(expect.objectContaining({ code: ErrorCode.InvalidCertificate }))
    expect(() =>
      exportPkcs12({ certificate, privateKey: garbage, password: PASSWORD })
    ).toThrow(expect.objectContaining({ code: ErrorCode.InvalidCertificate }))
  })
})

/** node-forge's writer, untyped in the module's slice: for a .p12 encrypted the way OpenSSL 3 does it (AES-256). */
type ForgeWriter = {
  pki: {
    certificateFromAsn1: (value: Asn1) => unknown
    privateKeyFromAsn1: (value: Asn1) => unknown
  }
  pkcs12: {
    toPkcs12Asn1: (
      key: unknown,
      certificate: unknown,
      password: string,
      options: { algorithm: string; useMac: boolean }
    ) => Asn1
  }
}

describe('importPkcs12', () => {
  it('reads back the key IPAForge exports, and its certificate’s serial', () => {
    const contents = importPkcs12(p12, PASSWORD)
    const serial = forge.pki
      .certificateFromAsn1(parse(identity.certificate))
      .serialNumber.toUpperCase()
      .replace(/^0+/, '')

    expect(contents.serialNumber).toBe(serial)
    expect(
      keyMatchesCertificate(contents.privateKey, identity.certificate)
    ).toBe(true)
  })

  it('tells another key from the certificate’s', async () => {
    const other = await crypto.subtle.generateKey(
      {
        name: 'RSASSA-PKCS1-v1_5',
        modulusLength: 2048,
        publicExponent: new Uint8Array([1, 0, 1]),
        hash: 'SHA-256'
      },
      true,
      ['sign', 'verify']
    )
    const otherKey = new Uint8Array(
      await crypto.subtle.exportKey('pkcs8', other.privateKey)
    )

    expect(keyMatchesCertificate(otherKey, identity.certificate)).toBe(false)
  })

  it('reads a .p12 encrypted with AES-256, as OpenSSL 3 writes them', () => {
    const writer = forge as unknown as ForgeWriter
    const aes = writer.pkcs12.toPkcs12Asn1(
      writer.pki.privateKeyFromAsn1(parse(privateKey)),
      writer.pki.certificateFromAsn1(parse(identity.certificate)),
      'modern',
      { algorithm: 'aes256', useMac: true }
    )
    const bytes = forge.util.binary.raw.decode(forge.asn1.toDer(aes).getBytes())

    expect(
      keyMatchesCertificate(
        importPkcs12(bytes, 'modern').privateKey,
        identity.certificate
      )
    ).toBe(true)
  })

  it('says when the password is wrong, and when the file is no .p12', () => {
    expect(() => importPkcs12(p12, 'wrong')).toThrow(
      expect.objectContaining({ code: ErrorCode.Pkcs12Password })
    )
    expect(() => importPkcs12(new Uint8Array([1, 2, 3]), PASSWORD)).toThrow(
      expect.objectContaining({ code: ErrorCode.InvalidCertificate })
    )
  })
})
