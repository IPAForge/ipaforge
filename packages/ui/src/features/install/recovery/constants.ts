import { RecoveryAction as R } from '@ipaforge/rpc'
import type { Fix } from '@ui/features/install/recovery/types.ts'

/** Where problems are reported: Report the problem opens a new issue here, filled in. */
export const ISSUES_URL = 'https://github.com/IPAForge/ipaforge/issues'

const APPLE_ACCOUNT_URL = 'https://account.apple.com'
const APPLE_DEVELOPER_URL = 'https://developer.apple.com/account'

/**
 * Every recovery action the Engine can offer, and what it does in an install run. The Engine lists them per error
 * code, first choice first (the diagnostics catalogue); a new action without an entry fails typecheck.
 */
export const fixes = {
  [R.Retry]: { kind: 'resume' },
  [R.WaitAndRetry]: {
    kind: 'resume',
    howKey: 'recovery.fix.waitAndRetry.how',
    buttonKey: 'recovery.retry'
  },
  [R.CheckNetwork]: {
    kind: 'resume',
    howKey: 'recovery.fix.checkNetwork.how',
    buttonKey: 'recovery.retry'
  },
  [R.CheckClock]: {
    kind: 'resume',
    stepKeys: [
      'recovery.fix.checkClock.step1',
      'recovery.fix.checkClock.step2'
    ],
    buttonKey: 'recovery.retry'
  },
  [R.ChangeAnisetteServer]: { kind: 'later' },
  [R.ReEnterPassword]: {
    kind: 'resume',
    howKey: 'recovery.fix.reEnterPassword.how',
    buttonKey: 'recovery.retry'
  },
  [R.ReEnterCode]: {
    kind: 'resume',
    howKey: 'recovery.fix.reEnterCode.how',
    buttonKey: 'recovery.retry'
  },
  [R.UseTrustedDevice]: {
    kind: 'resume',
    howKey: 'recovery.fix.useTrustedDevice.how',
    buttonKey: 'recovery.retry'
  },
  [R.SignInAgain]: {
    kind: 'resume',
    howKey: 'recovery.fix.signInAgain.how',
    buttonKey: 'recovery.retry'
  },
  [R.SignInOnAppleDevice]: {
    kind: 'resume',
    howKey: 'recovery.fix.signInOnAppleDevice.how',
    link: APPLE_ACCOUNT_URL,
    buttonKey: 'recovery.fix.done'
  },
  [R.SwitchAccount]: {
    kind: 'account',
    howKey: 'recovery.fix.switchAccount.how',
    buttonKey: 'recovery.fix.switchAccount.button'
  },
  [R.VerifyEmail]: {
    kind: 'resume',
    howKey: 'recovery.fix.verifyEmail.how',
    link: APPLE_ACCOUNT_URL,
    buttonKey: 'recovery.fix.done'
  },
  [R.AcceptAgreement]: {
    kind: 'resume',
    howKey: 'recovery.fix.acceptAgreement.how',
    link: APPLE_DEVELOPER_URL,
    buttonKey: 'recovery.fix.done'
  },
  // The Engine remembers the team per Apple ID, so starting again wouldn't ask: shown once there is a team picker.
  [R.ChooseTeam]: { kind: 'later' },
  [R.RevokeCertificate]: {
    kind: 'resume',
    howKey: 'recovery.fix.revokeCertificate.how',
    buttonKey: 'recovery.retry'
  },
  [R.WaitForAppIdSlot]: {
    kind: 'info',
    howKey: 'recovery.fix.waitForAppIdSlot.how'
  },
  [R.TryAnyway]: {
    kind: 'tryAnyway',
    howKey: 'recovery.fix.tryAnyway.how',
    buttonKey: 'recovery.try-anyway'
  },
  [R.ChooseAppToRemove]: {
    kind: 'resume',
    howKey: 'recovery.fix.chooseAppToRemove.how',
    buttonKey: 'recovery.retry'
  },
  [R.UnlockDevice]: {
    kind: 'resume',
    howKey: 'recovery.fix.unlockDevice.how',
    buttonKey: 'recovery.retry'
  },
  [R.EnableDeveloperMode]: {
    kind: 'resume',
    stepKeys: [
      'devices.notice.developerModeOff.step1',
      'devices.notice.developerModeOff.step2',
      'devices.notice.developerModeOff.step3'
    ],
    buttonKey: 'recovery.fix.enableDeveloperMode.button'
  },
  [R.TrustComputer]: {
    kind: 'pair',
    howKey: 'recovery.fix.trustComputer.how',
    buttonKey: 'recovery.fix.trustComputer.button'
  },
  [R.ReconnectDevice]: {
    kind: 'resume',
    howKey: 'recovery.fix.reconnectDevice.how',
    buttonKey: 'recovery.retry'
  },
  [R.PairAgain]: {
    kind: 'pair',
    howKey: 'recovery.fix.trustComputer.how',
    buttonKey: 'recovery.fix.trustComputer.button'
  },
  [R.SetPasscode]: {
    kind: 'resume',
    howKey: 'recovery.fix.setPasscode.how',
    buttonKey: 'recovery.retry'
  },
  [R.InstallDeviceSupport]: {
    kind: 'info',
    howKey: 'recovery.fix.installDeviceSupport.how'
  },
  [R.ReinstallApp]: {
    kind: 'resume',
    howKey: 'recovery.fix.reinstallApp.how',
    buttonKey: 'recovery.retry'
  },
  [R.ChooseAnotherIpa]: { kind: 'later' },
  [R.ChooseAnotherChannel]: {
    kind: 'channel',
    howKey: 'recovery.fix.chooseAnotherChannel.how',
    buttonKey: 'recovery.fix.chooseAnotherChannel.button'
  },
  [R.ImportIpa]: { kind: 'later' },
  [R.UpdateIPAForge]: { kind: 'later' },
  // Always offered under every failure, next to Copy diagnostics.
  [R.ReportIssue]: { kind: 'later' }
} satisfies Record<R, Fix>
