import type {
  AppId,
  AppIdPlan,
  DevelopmentCertificate,
  Team
} from '@apple/domain/types.ts'

/** A certificate IPAForge created, with the private key that only exists on this computer. */
export type CertificateIdentity = {
  readonly certificate: DevelopmentCertificate
  /** PKCS#8 DER. */
  readonly privateKey: Uint8Array
}

export type EnsureCertificateOptions = {
  /** Name Apple shows for the certificate's machine (identifies IPAForge in the revoke picker). */
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
  /** Called after each request to Apple, with what it was part of and how many of all are done. */
  readonly onProgress?: (progress: ProvisionProgress) => void
}

/** What provisioning is doing: checking the team, making App IDs, adding the app group, or getting profiles. */
export type ProvisionTask = 'team' | 'app-ids' | 'app-group' | 'profiles'

export type ProvisionProgress = {
  readonly task: ProvisionTask
  /** Within the task: requests done, and how many it makes. */
  readonly done: number
  readonly total: number
  /** Across the whole provisioning: 0–1. */
  readonly fraction: number
}

export type ProvisionResult = {
  readonly appIds: ReadonlyMap<string, AppId>
  /** Raw `.mobileprovision` bytes per bundle identifier, for the signer. */
  readonly profiles: ReadonlyMap<string, Uint8Array>
  readonly plan: AppIdPlan
}
