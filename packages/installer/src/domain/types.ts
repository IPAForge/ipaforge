import type { PromptKind } from '@installer/domain/prompts.ts'
import type { CertificateTrust } from '@installer/sidestore/trust.ts'
import type {
  Team,
  TrustedPhone,
  TwoFactorMethod,
  TwoFactorMethods
} from '@ipaforge/apple'
import type { Channel, ResolvedRelease } from '@ipaforge/catalog'
import type { AppFileTarget } from '@ipaforge/device'
import type { FileSource } from '@ipaforge/kernel'
import type { IpaInspection, SideloadIdentityPlan } from '@ipaforge/signer'

/** What is known about one provisioning profile on the device. */
export type ProfileFacts = {
  readonly uuid: string
  readonly teamId?: string
  /** `TEAMID.bundle.id`; may be a wildcard. */
  readonly applicationIdentifier?: string
  readonly createdAt?: Date
  readonly expiresAt?: Date
}

export type FreeProfileRules = {
  /** Free teams of the signed-in account. */
  readonly freeTeamIds: ReadonlySet<string>
  /** Any other team's profile counts as free when it lives at most this long. */
  readonly maxLifetimeMs: number
}

/** An installed app holding a free-profile slot. */
export type FreeProfileApp = {
  readonly bundleId: string
  readonly name?: string
}

// What the flows ask the user, and the answer each question expects.

export type CertificateChoice = {
  readonly serialNumber: string
  readonly machineName: string
  readonly expiresAt?: string
}

export type RemovableApp = {
  readonly bundleId: string
  readonly name?: string
}

export type PairingAppChoice = {
  readonly bundleId: string
  readonly appName: string
}

/** Each prompt's data and answer. */
export type Prompts = {
  readonly [PromptKind.Password]: { data: { appleId: string }; answer: string }
  readonly [PromptKind.TwoFactorMethod]: {
    data: { methods: TwoFactorMethods }
    answer: TwoFactorMethod
  }
  readonly [PromptKind.TwoFactorCode]: {
    data: {
      method: TwoFactorMethod
      codeLength: number
      /** The last code was wrong. */
      retry: boolean
      /** A new code was just asked for; `false` when Apple refused to send one. */
      resent?: boolean
      /** Numbers a code can be texted to instead. */
      phones: readonly TrustedPhone[]
    }
    answer: TwoFactorCodeAnswer
  }
  readonly [PromptKind.ChooseTeam]: {
    data: { teams: readonly Team[] }
    answer: string
  }
  readonly [PromptKind.RevokeCertificate]: {
    data: { certificates: readonly CertificateChoice[] }
    answer: string
  }
  readonly [PromptKind.ChooseAppToRemove]: {
    data: { limit: number; apps: readonly RemovableApp[]; installing: string }
    answer: string
  }
  readonly [PromptKind.ShareCertificate]: {
    data: { appName: string; bundleId: string }
    answer: boolean
  }
  readonly [PromptKind.ChoosePairingApps]: {
    data: { apps: readonly PairingAppChoice[] }
    answer: readonly string[]
  }
}

export type PromptData<K extends PromptKind> = Prompts[K]['data']

export type PromptAnswer<K extends PromptKind> = Prompts[K]['answer']

// The state install flows share. It holds data only: open devices and Apple sessions live in the run's
// FlowRuntime, and private keys stay in the SecretStore, so a checkpoint never carries a secret.

/** Where an app comes from: a catalog app (checksum-verified download) or a file the user picked. */
export type AppSource =
  | {
      readonly kind: 'catalog'
      readonly appId: string
      readonly channel?: Channel
    }
  | { readonly kind: 'file'; readonly file: FileSource }

/** One app moving through a flow; each step fills in what it produced. */
/** A signed IPA in the scratch store. */
export type SignedIpa = {
  readonly key: string
  readonly file: FileSource
}

export type AppJob = {
  readonly source: AppSource
  readonly release?: ResolvedRelease
  readonly file?: FileSource
  readonly inspection?: IpaInspection
  /** Why this app may receive the signing certificate. Without it, it never does. */
  readonly trust?: CertificateTrust
  readonly identity?: SideloadIdentityPlan
  /** Raw provisioning profiles keyed by new bundle ID. */
  readonly profiles?: ReadonlyMap<string, Uint8Array>
  /** The signed IPA, waiting in the scratch store under `key` until the install step ends. */
  readonly signed?: SignedIpa
  readonly installed?: boolean
}

export type DeviceSummary = {
  readonly udid: string
  readonly name: string
  readonly iosVersion: string
  /** lockdownd's `DeviceClass` (`iPhone`, `iPad`, `iPod`), for checking an app's device families. */
  readonly deviceClass: string
}

/** What every flow that talks to a device and an Apple account knows. */
export type AccountState = {
  readonly udid: string
  readonly accountId: string
  /** Team chosen up front; otherwise the remembered one, the only one, or the user's choice. */
  readonly teamId?: string
  readonly device?: DeviceSummary
  readonly team?: Team
}

export type InstallState = AccountState & {
  readonly apps: readonly AppJob[]
  /** Serial number of the development certificate in use (the key itself stays in the SecretStore). */
  readonly certificateSerial?: string
  /** Pairing-app id (`PAIRING_APPS`) whose pairing file goes into the first app once installed. */
  readonly pairingApp?: string
  readonly pairingPlaced?: readonly AppFileTarget[]
}

/**
 * The answer to the code question: the code, or a request for another one, by the same way (`resend`) or by text
 * message to one of the account's numbers (`textTo`, a phone id).
 */
export type TwoFactorCodeAnswer =
  | string
  | { readonly resend: true }
  | { readonly textTo: number }
