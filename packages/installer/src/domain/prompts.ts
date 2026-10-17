// What the flows ask the user, and the answer each question expects. The UI (or a terminal) answers by `kind`.

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
