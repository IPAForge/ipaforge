export type ByteBuffer = {
  getBytes: () => string
}

export type Asn1 = {
  readonly tagClass: number
  readonly type: number
  readonly constructed: boolean
  readonly value: string | Asn1[]
}

export type BlockCipher = {
  readonly output: ByteBuffer
  start: (options: { readonly iv: ByteBuffer }) => void
  update: (input: ByteBuffer) => void
  finish: () => boolean
}

export type MessageDigest = {
  update: (bytes: string) => MessageDigest
  digest: () => ByteBuffer
}

export type Hmac = {
  start: (digest: 'sha1', key: ByteBuffer) => void
  update: (bytes: string) => void
  getMac: () => ByteBuffer
}

export type RsaModulus = {
  readonly n: { toString: (radix: number) => string }
}

/** A parsed bag, as node-forge's PKCS#12 reader returns it (used by tests to round-trip). */
export type Pkcs12Bag = {
  readonly key?: RsaModulus
  readonly cert?: { readonly publicKey: RsaModulus }
  readonly attributes: Readonly<Record<string, readonly string[] | undefined>>
}

export type Forge = {
  readonly util: {
    readonly ByteBuffer: new (bytes?: string) => ByteBuffer
    readonly binary: {
      readonly raw: {
        encode: (bytes: Uint8Array) => string
        decode: (text: string) => Uint8Array
      }
    }
  }
  readonly asn1: {
    readonly Class: {
      readonly UNIVERSAL: number
      readonly CONTEXT_SPECIFIC: number
    }
    readonly Type: {
      readonly INTEGER: number
      readonly OCTETSTRING: number
      readonly NULL: number
      readonly OID: number
      readonly SEQUENCE: number
      readonly SET: number
      readonly BMPSTRING: number
    }
    create: (
      tagClass: number,
      type: number,
      constructed: boolean,
      value: string | Asn1[]
    ) => Asn1
    fromDer: (
      bytes: string,
      options?: { readonly strict?: boolean; readonly parseAllBytes?: boolean }
    ) => Asn1
    toDer: (value: Asn1) => ByteBuffer
    oidToDer: (oid: string) => ByteBuffer
    derToOid: (bytes: string) => string
    integerToDer: (value: number) => ByteBuffer
    derToInteger: (bytes: string) => number
  }
  readonly cipher: {
    createCipher: (algorithm: '3DES-CBC', key: ByteBuffer) => BlockCipher
  }
  readonly md: { readonly sha1: { create: () => MessageDigest } }
  readonly hmac: { create: () => Hmac }
  readonly pki: {
    readonly pbe: {
      /** PKCS#12 key derivation (RFC 7292 appendix B); `id` 1 = key, 2 = IV, 3 = MAC key. */
      generatePkcs12Key: (
        password: string,
        salt: ByteBuffer,
        id: number,
        iterations: number,
        length: number
      ) => ByteBuffer
    }
  }
  readonly pkcs12: {
    pkcs12FromAsn1: (
      value: Asn1,
      strict: boolean,
      password: string
    ) => {
      getBags: (filter: {
        readonly bagType: string
      }) => Record<string, Pkcs12Bag[] | undefined>
    }
  }
}
