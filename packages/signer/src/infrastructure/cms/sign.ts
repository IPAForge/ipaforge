import * as asn1js from 'asn1js'
import * as pkijs from 'pkijs'

import {
  compareBytes,
  createDict,
  ErrorCode,
  IPAForgeError,
  serializeXmlPlist
} from '@ipaforge/kernel'
import { CS_CDHASH_LEN } from '@signer/domain/blobs/constants.ts'
import type { Hasher } from '@signer/domain/ports/types.ts'
import {
  parseCertificate,
  toArrayBuffer
} from '@signer/infrastructure/cms/certificate.ts'
import {
  DIGEST_OID,
  OID_APPLE_CDHASHES,
  OID_APPLE_CDHASHES2,
  OID_CONTENT_TYPE,
  OID_DATA,
  OID_MESSAGE_DIGEST,
  OID_SHA256_WITH_RSA,
  OID_SIGNED_DATA,
  OID_SIGNING_TIME
} from '@signer/infrastructure/cms/oids.ts'
import type {
  SignedCodeDirectory,
  SigningIdentity
} from '@signer/infrastructure/cms/types.ts'

/** UTCTime for 1950–2049, GeneralizedTime otherwise (RFC 5652 §11.3). */
const signingTimeValue = (
  date: Date
): asn1js.UTCTime | asn1js.GeneralizedTime => {
  const year = date.getUTCFullYear()
  const truncated = new Date(Math.floor(date.getTime() / 1000) * 1000)

  return year >= 1950 && year < 2050
    ? new asn1js.UTCTime({ valueDate: truncated })
    : new asn1js.GeneralizedTime({ valueDate: truncated })
}

const attributeDer = (attribute: pkijs.Attribute): Uint8Array =>
  new Uint8Array(attribute.toSchema().toBER(false))

/** DER `SET OF`: elements sorted by their encodings. */
const derSorted = <T>(
  items: readonly T[],
  encode: (item: T) => Uint8Array
): T[] =>
  items
    .map((item) => ({ item, der: encode(item) }))
    .sort((a, b) => compareBytes(a.der, b.der))
    .map(({ item }) => item)

const octetString = (bytes: Uint8Array): asn1js.OctetString =>
  new asn1js.OctetString({ valueHex: toArrayBuffer(bytes) })

/** Apple's cdhashes plist attribute: every CD's hash truncated to the cdhash length. */
const cdhashesPlist = (fullHashes: readonly Uint8Array[]): Uint8Array =>
  serializeXmlPlist(
    createDict([
      ['cdhashes', fullHashes.map((hash) => hash.slice(0, CS_CDHASH_LEN))]
    ])
  )

/** Apple's cdhashes2 attribute values: `SEQUENCE { digest OID, full hash }` per CD, DER-sorted. */
const cdhashes2Values = (
  codeDirectories: readonly SignedCodeDirectory[],
  fullHashes: readonly Uint8Array[]
): asn1js.Sequence[] =>
  derSorted(
    codeDirectories.map(
      (cd, i) =>
        new asn1js.Sequence({
          value: [
            new asn1js.ObjectIdentifier({ value: DIGEST_OID[cd.algorithm] }),
            octetString(fullHashes[i] as Uint8Array)
          ]
        })
    ),
    (value) => new Uint8Array(value.toBER(false))
  )

/** The signed attributes, DER-sorted as a `SET OF`. */
const signedAttributes = (input: {
  readonly codeDirectories: readonly SignedCodeDirectory[]
  readonly fullHashes: readonly Uint8Array[]
  readonly messageDigest: Uint8Array
  readonly signingTime: Date
}): pkijs.Attribute[] =>
  derSorted(
    [
      new pkijs.Attribute({
        type: OID_CONTENT_TYPE,
        values: [new asn1js.ObjectIdentifier({ value: OID_DATA })]
      }),
      new pkijs.Attribute({
        type: OID_SIGNING_TIME,
        values: [signingTimeValue(input.signingTime)]
      }),
      new pkijs.Attribute({
        type: OID_MESSAGE_DIGEST,
        values: [octetString(input.messageDigest)]
      }),
      new pkijs.Attribute({
        type: OID_APPLE_CDHASHES2,
        values: cdhashes2Values(input.codeDirectories, input.fullHashes)
      }),
      new pkijs.Attribute({
        type: OID_APPLE_CDHASHES,
        values: [octetString(cdhashesPlist(input.fullHashes))]
      })
    ],
    attributeDer
  )

/**
 * Apple writes sha256WithRSAEncryption with an explicit NULL parameter (pkijs omits it). The signature
 * covers only the signed attributes, so adjusting this identifier afterwards is safe.
 */
const useExplicitNullParameter = (signedData: pkijs.SignedData): void => {
  const signer = signedData.signerInfos[0]
  if (signer?.signatureAlgorithm.algorithmId !== OID_SHA256_WITH_RSA) return
  signer.signatureAlgorithm = new pkijs.AlgorithmIdentifier({
    algorithmId: OID_SHA256_WITH_RSA,
    algorithmParams: new asn1js.Null()
  })
}

/**
 * Detached CMS SignedData over the primary CodeDirectory, with Apple's cdhash attributes
 * (signer-spec §5). `codeDirectories` lists every CD in the SuperBlob, primary first.
 */
export const signCodeDirectories = async (
  codeDirectories: readonly SignedCodeDirectory[],
  identity: SigningIdentity,
  signingTime: Date,
  hasher: Hasher
): Promise<Uint8Array> => {
  const primary = codeDirectories[0]
  if (!primary)
    throw new IPAForgeError(ErrorCode.Unexpected, {
      message: 'no CodeDirectory to sign'
    })

  const fullHashes = await Promise.all(
    codeDirectories.map((cd) => hasher.digest(cd.algorithm, cd.bytes))
  )
  const messageDigest = await hasher.digest('sha256', primary.bytes)
  const attributes = signedAttributes({
    codeDirectories,
    fullHashes,
    messageDigest,
    signingTime
  })

  const leaf = parseCertificate(identity.certificate)
  const signedData = new pkijs.SignedData({
    version: 1,
    encapContentInfo: new pkijs.EncapsulatedContentInfo({
      eContentType: OID_DATA
    }),
    // certificates [0] IMPLICIT SET: DER-sorted like any SET OF (verified against codesign with a real
    // Apple Development certificate: G3, Apple Root CA, then the leaf)
    certificates: derSorted(
      [leaf, ...identity.chain.map(parseCertificate)],
      (cert) => new Uint8Array(cert.toSchema(true).toBER(false))
    ),
    signerInfos: [
      new pkijs.SignerInfo({
        version: 1,
        sid: new pkijs.IssuerAndSerialNumber({
          issuer: leaf.issuer,
          serialNumber: leaf.serialNumber
        }),
        signedAttrs: new pkijs.SignedAndUnsignedAttributes({
          type: 0,
          attributes
        })
      })
    ]
  })

  try {
    await signedData.sign(
      identity.privateKey,
      0,
      'SHA-256',
      toArrayBuffer(primary.bytes)
    )
    useExplicitNullParameter(signedData)
  } catch (error) {
    throw new IPAForgeError(ErrorCode.InvalidCertificate, {
      message: 'CMS signing failed',
      cause: error
    })
  }
  const contentInfo = new pkijs.ContentInfo({
    contentType: OID_SIGNED_DATA,
    content: signedData.toSchema(true)
  })

  return new Uint8Array(contentInfo.toSchema().toBER(false))
}
