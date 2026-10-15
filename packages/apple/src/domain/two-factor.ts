import type { SecondFactorKind } from '@apple/domain/session.ts'

export type TrustedPhone = {
  readonly id: number
  /** As Apple shows it, e.g. "+40 ••• ••• •12". */
  readonly number: string
}

export type TwoFactorMethods = {
  readonly trustedDevice: boolean
  readonly phones: readonly TrustedPhone[]
  /** Digits Apple expects (6 for current accounts, 4 for legacy ones). */
  readonly codeLength: number
  /** Legacy two-step (`hsa`) account: codes go to a trusted device id. */
  readonly legacy: boolean
  /** The account only has security keys, which Loadstar cannot use. */
  readonly securityKeysOnly: boolean
}

export type TwoFactorMethod =
  | { readonly type: 'trusted_device' }
  | { readonly type: 'sms'; readonly phoneId: number }
  | { readonly type: 'legacy_device'; readonly deviceId: string }

export const DEFAULT_CODE_LENGTH = 6
export const LEGACY_CODE_LENGTH = 4

/** What Apple's JSON 2FA state says, before it is turned into `TwoFactorMethods`. */
export type AuthStatus = {
  readonly legacy: boolean
  readonly phones: readonly TrustedPhone[]
  readonly codeLength?: number
  /** Security keys are registered (or a security-key challenge is pending). */
  readonly hasSecurityKeys: boolean
}

/** Only the trusted-device prompt, for when Apple refuses to describe the other methods. */
export const TRUSTED_DEVICE_ONLY: TwoFactorMethods = {
  trustedDevice: true,
  phones: [],
  codeLength: DEFAULT_CODE_LENGTH,
  legacy: false,
  securityKeysOnly: false
}

/** The methods offered for this sign-in, from Apple's 2FA state and the factor GSA asked for first. */
export const twoFactorMethods = (
  status: AuthStatus,
  requested: SecondFactorKind
): TwoFactorMethods => ({
  trustedDevice: requested === 'trusted_device' || status.legacy,
  phones: status.phones,
  codeLength:
    status.codeLength ??
    (status.legacy ? LEGACY_CODE_LENGTH : DEFAULT_CODE_LENGTH),
  legacy: status.legacy,
  securityKeysOnly: status.hasSecurityKeys && status.phones.length === 0
})
