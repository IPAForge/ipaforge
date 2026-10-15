// The state install flows share. It holds data only: open devices and Apple sessions live in the run's
// FlowRuntime, and private keys stay in the SecretStore, so a checkpoint never carries a secret.
import type { CertificateTrust } from "@installer/sidestore/trust.ts";
import type { Team } from "@loadstar/apple";
import type { Channel, ResolvedRelease } from "@loadstar/catalog";
import type { AppFileTarget } from "@loadstar/device";
import type { FileSource } from "@loadstar/kernel";
import type { IpaInspection, SideloadIdentityPlan } from "@loadstar/signer";

/** Where an app comes from: a catalog app (checksum-verified download) or a file the user picked. */
export type AppSource =
  | { readonly kind: "catalog"; readonly appId: string; readonly channel?: Channel }
  | { readonly kind: "file"; readonly file: FileSource };

/** One app moving through a flow; each step fills in what it produced. */
/** A signed IPA in the scratch store. */
export interface SignedIpa {
  readonly key: string;
  readonly file: FileSource;
}

export interface AppJob {
  readonly source: AppSource;
  readonly release?: ResolvedRelease;
  readonly file?: FileSource;
  readonly inspection?: IpaInspection;
  /** Why this app may receive the signing certificate. Without it, it never does. */
  readonly trust?: CertificateTrust;
  readonly identity?: SideloadIdentityPlan;
  /** Raw provisioning profiles keyed by new bundle ID. */
  readonly profiles?: ReadonlyMap<string, Uint8Array>;
  /** The signed IPA, waiting in the scratch store under `key` until the install step ends. */
  readonly signed?: SignedIpa;
  readonly installed?: boolean;
}

export interface DeviceSummary {
  readonly udid: string;
  readonly name: string;
  readonly iosVersion: string;
  /** lockdownd's `DeviceClass` (`iPhone`, `iPad`, `iPod`), for checking an app's device families. */
  readonly deviceClass: string;
}

/** What every flow that talks to a device and an Apple account knows. */
export interface AccountState {
  readonly udid: string;
  readonly accountId: string;
  /** Team chosen up front; otherwise the remembered one, the only one, or the user's choice. */
  readonly teamId?: string;
  readonly device?: DeviceSummary;
  readonly team?: Team;
}

export interface InstallState extends AccountState {
  readonly apps: readonly AppJob[];
  /** Serial number of the development certificate in use (the key itself stays in the SecretStore). */
  readonly certificateSerial?: string;
  /** Pairing-app id (`PAIRING_APPS`) whose pairing file goes into the first app once installed. */
  readonly pairingApp?: string;
  readonly pairingPlaced?: readonly AppFileTarget[];
}
