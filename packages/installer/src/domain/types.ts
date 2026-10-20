import type { PromptKind } from '@installer/domain/prompts.ts'
import type { CertificateTrust } from '@installer/sidestore/trust.ts'
import type {
  Team,
  TrustedPhone,
  TwoFactorMethod,
  TwoFactorMethods
} from '@ipaforge/apple'
import type { Channel, ResolvedRelease } from '@ipaforge/catalog'
import type { AppFileTarget, DeveloperModeState } from '@ipaforge/device'
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

/** Where an app comes from: a catalog app (checksum-verified download), a file, or an app installed before. */
export type AppSource =
  | {
      readonly kind: 'catalog'
      readonly appId: string
      readonly channel?: Channel
    }
  | {
      readonly kind: 'file'
      readonly file: FileSource
      /** Where the file came from (a link, or a file the user picked), remembered with the installed app. */
      readonly origin?: AppOrigin
      /**
       * Refresh or Update: the original bundle id of the installed app this file must be. Anything else is refused,
       * so a link (from an app's mark, or a source) can't put another app in its place, with its data.
       */
      readonly replaces?: string
    }
  | {
      /** An app installed before, signed again from its kept IPA (Refresh). */
      readonly kind: 'installed'
      readonly file: FileSource
      readonly record: InstalledRecord
    }

/** Where an installed app first came from, as it's remembered (for Refresh, and to say so). */
export type AppOrigin =
  | {
      readonly kind: 'catalog'
      readonly appId: string
      readonly channel?: Channel
    }
  | { readonly kind: 'url'; readonly url: string }
  | { readonly kind: 'file'; readonly name: string }

/** An app the Engine installed on a device, remembered so it can be refreshed before it expires. */
export type InstalledRecord = {
  readonly udid: string
  /** As installed (after sideload renaming). */
  readonly bundleId: string
  /** As the IPA has it. */
  readonly originalBundleId: string
  readonly name: string
  readonly version?: string
  readonly origin: AppOrigin
  /** The certificate was shared with it (checksum-verified catalog release, or the user agreed). */
  readonly trust?: CertificateTrust
  /** ISO 8601. */
  readonly installedAt: string
  /** Its original IPA in the kept-IPA store. */
  readonly keptKey: string
}

/** IPAForge's mark on an app it installed, read from the app on the device (so any computer knows it). */
export type AppMarker = {
  readonly originalBundleId: string
  readonly origin: AppOrigin
  /** The development certificate that signed it: while that's valid, a new profile is all a refresh needs. */
  readonly certificateSerial?: string
}

/** How an app is refreshed: a new profile only (its certificate is still valid), or signed and installed again. */
export type RefreshDecision =
  | { readonly bundleId: string; readonly kind: 'profile' }
  | {
      readonly bundleId: string
      readonly kind: 'reinstall'
      /**
       * Its certificate was revoked or replaced, it carries no IPAForge mark saying which one signed it, or it is
       * SideStore, which shows the expiry of the profile inside its own files (a new profile alone leaves its date
       * as it was).
       */
      readonly reason: 'certificate' | 'unmarked' | 'sidestore'
    }

/** An app on the device signed with one of the user's teams, as the Apps page lists it. */
export type InstalledApp = {
  readonly bundleId: string
  readonly name: string
  readonly version?: string
  readonly teamId: string
  /** When its profile expires, and with it the app; undefined when the device shows no profile for it. */
  readonly expiresAt?: Date
  /** Installed by IPAForge on this computer, which keeps its IPA: it can be refreshed from that copy. */
  readonly record?: InstalledRecord
  /** Installed by IPAForge (on this computer or another): where it came from, read from the app itself. */
  readonly marker?: AppMarker
}

/** Whose team signed SideStore: the chosen team, another of the Apple ID's teams, or another Apple ID's. */
export type SideStoreSigner = 'team' | 'other-team' | 'other-apple-id'

/**
 * SideStore on a device, checked for what keeps it from refreshing apps by itself. `signing` is `unknown` when the
 * app has no IPAForge mark (installed by another tool), so the certificate that signed it can't be told.
 */
export type SideStoreHealth = {
  readonly bundleId: string
  readonly version?: string
  /** The catalog's latest version on its channel; undefined when the catalog can't be reached. */
  readonly latest?: string
  readonly channel: Channel
  readonly signedBy: SideStoreSigner
  readonly expiresAt?: Date
  readonly signing: 'valid' | 'revoked' | 'unknown'
  /** The certificate inside SideStore: valid, missing, or not one of the team's valid ones (it may have replaced it). */
  readonly ownCertificate: 'valid' | 'missing' | 'other'
  /** Its pairing file: this computer's, another computer's, or none. */
  readonly pairing: 'this-computer' | 'other-computer' | 'missing'
}

/** What Repair SideStore found: the device's state and, when it's installed, SideStore's health. */
export type SideStoreCheck = {
  readonly locked: boolean
  readonly developerMode: DeveloperModeState
  readonly sideStore?: SideStoreHealth
}

/** One app moving through a flow; each step fills in what it produced. */
/** A signed IPA in the scratch store. */
export type SignedIpa = {
  readonly key: string
  readonly file: FileSource
  /** Written compressed, because the device is on Wi-Fi. */
  readonly compressed?: boolean
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
  /** Create App IDs even though Apple's count says none are left, when that count was negative (Try anyway). */
  readonly tryAnyway?: boolean
}

/**
 * The answer to the code question: the code, or a request for another one, by the same way (`resend`) or by text
 * message to one of the account's numbers (`textTo`, a phone id).
 */
export type TwoFactorCodeAnswer =
  | string
  | { readonly resend: true }
  | { readonly textTo: number }
