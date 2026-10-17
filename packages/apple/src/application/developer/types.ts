import type {
  AppId,
  AppIdPlan,
  DevelopmentCertificate,
  Team
} from '@apple/domain/types.ts'

/** A certificate Loadstar created, with the private key that only exists on this computer. */
export type CertificateIdentity = {
  readonly certificate: DevelopmentCertificate
  /** PKCS#8 DER. */
  readonly privateKey: Uint8Array
}

export type EnsureCertificateOptions = {
  /** Name Apple shows for the certificate's machine (identifies Loadstar in the revoke picker). */
  readonly machineName: string
  /** A certificate (and key) saved from an earlier run: reused while Apple still lists it. */
  readonly stored?: CertificateIdentity
}

export type BundleRequest = {
  /** Bundle identifier after sideload renaming, e.g. `com.SideStore.SideStore.ABCDE12345`. */
  readonly identifier: string
  readonly name: string
}

export type ProvisionRequest = {
  readonly team: Team
  readonly device: { readonly udid: string; readonly name: string }
  /** Main app first, then its extensions. */
  readonly bundles: readonly BundleRequest[]
  /** App group to register and assign to every bundle (e.g. `group.com.SideStore.SideStore.ABCDE12345`). */
  readonly appGroup?: string
}

export type ProvisionResult = {
  readonly appIds: ReadonlyMap<string, AppId>
  /** Raw `.mobileprovision` bytes per bundle identifier, for the signer. */
  readonly profiles: ReadonlyMap<string, Uint8Array>
  readonly plan: AppIdPlan
}
