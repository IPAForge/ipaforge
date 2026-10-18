// What the fake Engine plays. Each scenario changes one thing about the happy path; a failing one fails its step
// once with a real ErrorCode, so retrying from the checkpoint succeeds.
import { ErrorCode } from '@ipaforge/kernel'
import type {
  FakeFailure,
  FakeScenarioId
} from '@ui/services/engine/fake/types.ts'

export const fakeScenarioIds = [
  'happy',
  'hot-plug',
  'devices',
  'accounts',
  'no-accounts',
  'sign-in-no-2fa',
  'wrong-password',
  'two-factor',
  'two-teams',
  'certificate-limit',
  'free-app-limit',
  'retry',
  'device-locked',
  'app-id-quota',
  'profile-banned',
  'offline',
  'checksum',
  'unsupported-ios',
  'anisette',
  'logs'
] as const

/** The step each failing scenario stops at, once. */
export const fakeFailures: Partial<Record<FakeScenarioId, FakeFailure>> = {
  'device-locked': { stepId: 'install-0', code: ErrorCode.DeviceLocked },
  'app-id-quota': { stepId: 'app-ids', code: ErrorCode.AppIdQuotaExceeded },
  'profile-banned': { stepId: 'install-0', code: ErrorCode.ProfileBanned },
  offline: { stepId: 'resolve-0', code: ErrorCode.Offline },
  checksum: { stepId: 'download-0', code: ErrorCode.ChecksumMismatch },
  'unsupported-ios': { stepId: 'inspect-0', code: ErrorCode.UnsupportedIos },
  anisette: { stepId: 'sign-in', code: ErrorCode.AnisetteUnavailable }
}

export const isFakeScenarioId = (value: unknown): value is FakeScenarioId =>
  typeof value === 'string' &&
  (fakeScenarioIds as readonly string[]).includes(value)

/** `?scenario=two-factor` picks a scenario in the dev host; anything else plays the happy path. */
export const scenarioFromSearch = (search: string): FakeScenarioId => {
  const value = new URLSearchParams(search).get('scenario')

  return isFakeScenarioId(value) ? value : 'happy'
}
