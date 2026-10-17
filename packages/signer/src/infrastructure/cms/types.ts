import type * as pkijs from 'pkijs'

import type { Logger } from '@loadstar/kernel'
import type { HashAlgorithm } from '@signer/domain/ports/types.ts'

/** Downloads a certificate (DER or PEM) from an AIA `caIssuers` URL. Provided by the caller (HttpClient port). */
export type IssuerFetcher = (
  url: string,
  signal?: AbortSignal
) => Promise<Uint8Array>

export type ChainResolution = {
  /** Intermediate(s) then root, as embedded in the CMS after the leaf. */
  readonly chain: readonly Uint8Array[]
  readonly source: 'bundled' | 'fetched'
  readonly fetchedFrom?: string
}

export type ResolveChainOptions = {
  /** Used only when the leaf's issuer is not bundled. Without it, unknown issuers fail. */
  readonly fetchIssuer?: IssuerFetcher
  /** Trust anchors (default: the bundled Apple roots). Tests inject their own. */
  readonly roots?: readonly Uint8Array[]
  /** Known intermediates (default: the bundled Apple WWDR CAs). */
  readonly intermediates?: readonly Uint8Array[]
  readonly logger?: Logger
  readonly signal?: AbortSignal
}

/** A certificate kept with its original DER bytes (what gets embedded). */
export type KnownCertificate = {
  readonly der: Uint8Array
  readonly cert: pkijs.Certificate
}

export type SigningIdentity = {
  /** Leaf certificate (DER). */
  readonly certificate: Uint8Array
  /** Intermediate(s) + root to embed, issuer-first after the leaf. */
  readonly chain: readonly Uint8Array[]
  /** RSASSA-PKCS1-v1_5/SHA-256 or ECDSA/SHA-256 signing key. */
  readonly privateKey: CryptoKey
}

export type SignedCodeDirectory = {
  readonly bytes: Uint8Array
  readonly algorithm: HashAlgorithm
}
