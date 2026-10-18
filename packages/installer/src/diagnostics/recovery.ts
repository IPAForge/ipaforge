// What the user can do about a failure, as stable ids. The UI turns each into a button or an instruction.
export const RecoveryAction = {
  Retry: 'retry',
  WaitAndRetry: 'wait-and-retry',
  CheckNetwork: 'check-network',
  CheckClock: 'check-clock',
  ChangeAnisetteServer: 'change-anisette-server',
  ReEnterPassword: 're-enter-password',
  ReEnterCode: 're-enter-code',
  UseTrustedDevice: 'use-trusted-device',
  SignInAgain: 'sign-in-again',
  SignInOnAppleDevice: 'sign-in-on-apple-device',
  SwitchAccount: 'switch-account',
  VerifyEmail: 'verify-email',
  AcceptAgreement: 'accept-agreement',
  ChooseTeam: 'choose-team',
  RevokeCertificate: 'revoke-certificate',
  WaitForAppIdSlot: 'wait-for-app-id-slot',
  ChooseAppToRemove: 'choose-app-to-remove',
  UnlockDevice: 'unlock-device',
  EnableDeveloperMode: 'enable-developer-mode',
  TrustComputer: 'trust-computer',
  ReconnectDevice: 'reconnect-device',
  PairAgain: 'pair-again',
  SetPasscode: 'set-passcode',
  InstallDeviceSupport: 'install-device-support',
  ReinstallApp: 'reinstall-app',
  ChooseAnotherIpa: 'choose-another-ipa',
  ChooseAnotherChannel: 'choose-another-channel',
  ImportIpa: 'import-ipa',
  UpdateIPAForge: 'update-ipaforge',
  ReportIssue: 'report-issue'
} as const

export type RecoveryAction =
  (typeof RecoveryAction)[keyof typeof RecoveryAction]
