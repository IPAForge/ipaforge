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
import { exportPkcs12 } from '@signer/infrastructure/pkcs12/index.ts'
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
