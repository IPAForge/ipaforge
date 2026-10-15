// Small DER builders over node-forge's ASN.1 model. Byte strings are node-forge "binary strings".
import { type Asn1, forge } from '@signer/infrastructure/pkcs12/forge.ts'

export type { Asn1 }

const { asn1 } = forge

const universal = (
  type: number,
  constructed: boolean,
  value: string | Asn1[]
): Asn1 => asn1.create(asn1.Class.UNIVERSAL, type, constructed, value)

export const sequence = (items: Asn1[]): Asn1 =>
  universal(asn1.Type.SEQUENCE, true, items)
export const set = (items: Asn1[]): Asn1 =>
  universal(asn1.Type.SET, true, items)
export const oid = (value: string): Asn1 =>
  universal(asn1.Type.OID, false, asn1.oidToDer(value).getBytes())
export const octets = (bytes: string): Asn1 =>
  universal(asn1.Type.OCTETSTRING, false, bytes)
export const integer = (value: number): Asn1 =>
  universal(asn1.Type.INTEGER, false, asn1.integerToDer(value).getBytes())
export const nullValue = (): Asn1 => universal(asn1.Type.NULL, false, '')
/** node-forge encodes BMPString values as UTF-16BE itself. */
export const bmpString = (text: string): Asn1 =>
  universal(asn1.Type.BMPSTRING, false, text)

/** `[tag]` EXPLICIT wrapper. */
export const explicit = (tag: number, item: Asn1): Asn1 =>
  asn1.create(asn1.Class.CONTEXT_SPECIFIC, tag, true, [item])
/** `[tag]` IMPLICIT OCTET STRING. */
export const implicitOctets = (tag: number, bytes: string): Asn1 =>
  asn1.create(asn1.Class.CONTEXT_SPECIFIC, tag, false, bytes)

export const toDer = (value: Asn1): string => asn1.toDer(value).getBytes()

/** Strict DER parse that rejects trailing bytes. */
export const fromDer = (bytes: string): Asn1 =>
  asn1.fromDer(bytes, { strict: true, parseAllBytes: true })

export const toBinary = (bytes: Uint8Array): string =>
  forge.util.binary.raw.encode(bytes)
export const fromBinary = (bytes: string): Uint8Array =>
  forge.util.binary.raw.decode(bytes)

export const sha1 = (bytes: string): string =>
  forge.md.sha1.create().update(bytes).digest().getBytes()
