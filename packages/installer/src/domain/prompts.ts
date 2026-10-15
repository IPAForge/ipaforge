// What the flows ask the user, and the answer each question expects. The UI (or a terminal) answers by `kind`.
import type { Team, TwoFactorMethod, TwoFactorMethods } from '@loadstar/apple'

export const PromptKind = {
  /** The saved session expired and no password is stored. Answer: the password. */
  Password: 'apple.password',
  /** Several second-factor methods are offered. Answer: one of `methods`, as a TwoFactorMethod. */
  TwoFactorMethod: 'apple.two_factor_method',
  /** Answer: the code the user received. */
  TwoFactorCode: 'apple.two_factor_code',
  /** The account has several teams. Answer: a team id. */
  ChooseTeam: 'apple.choose_team',
  /** The team has no room for another certificate. Answer: the serial number to revoke. */
  RevokeCertificate: 'apple.revoke_certificate',
  /** Installing would exceed the free-app limit. Answer: the bundle ID to remove. */
  ChooseAppToRemove: 'device.choose_app_to_remove',
  /** A manually imported IPA looks like SideStore. Answer: true to share the signing certificate with it. */
  ShareCertificate: 'installer.share_certificate',
  /** Answer: the bundle IDs to place the pairing file into. */
  ChoosePairingApps: 'device.choose_pairing_apps'
} as const

export type PromptKind = (typeof PromptKind)[keyof typeof PromptKind]

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
    data: { method: TwoFactorMethod; codeLength: number; retry: boolean }
    answer: string
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
