import type {
  AuthStatus,
  SecondFactorKind,
  TwoFactorMethods
} from '@apple/domain/types.ts'

export const DEFAULT_CODE_LENGTH = 6
export const LEGACY_CODE_LENGTH = 4

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
