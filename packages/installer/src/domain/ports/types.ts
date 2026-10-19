import type { FileSource } from '@ipaforge/kernel'
import type {
  BundleAdditions,
  CodeBundle,
  IpaInspection
} from '@ipaforge/signer'

/** Everything needed to sign one IPA for sideloading. */
export type SignRequest = {
  readonly teamId: string
  /** DER leaf certificate. */
  readonly certificate: Uint8Array
  /** PKCS#8 DER private key. */
  readonly privateKey: Uint8Array
  readonly newMainBundleId: string
  /** Raw provisioning profiles keyed by the new bundle ID they provision. */
  readonly profiles: ReadonlyMap<string, Uint8Array>
  readonly appGroups: ReadonlyMap<string, string>
  readonly deviceUdid: string
  readonly additions?: BundleAdditions
  /** Deflate level of the signed IPA, 0–9 (default 0: stored, fastest to write). */
  readonly compressionLevel?: number
  /** 0–1. */
  readonly onProgress?: (fraction: number) => void
  readonly signal?: AbortSignal
}

/**
 * The signer as the flows use it. The default is `@ipaforge/signer`; tests swap in a fake so flows run without
 * real certificates.
 */
export type IpaSigner = {
  inspect(file: FileSource, signal?: AbortSignal): Promise<IpaInspection>
  /** Every code bundle with its original identifier (to tell whether SideStore would get the certificate). */
  bundles(
    file: FileSource,
    signal?: AbortSignal
  ): Promise<readonly CodeBundle[]>
  /** The signed IPA as a stream; consume it once. */
  sign(
    file: FileSource,
    request: SignRequest
  ): Promise<ReadableStream<Uint8Array>>
}
