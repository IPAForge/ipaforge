// Repair SideStore for the fake Engine: the check reads the fake installed SideStore (its expiry) and the
// scenario's problems; a repair run plays the fixes it was asked for and clears those problems.
//   sidestore-broken      expired, holding no certificate, no pairing file
//   sidestore-unknown     installed by another tool (no mark), holding a replaced certificate, another computer's
//                         pairing file, an older version
//   sidestore-other-team  signed by another Apple ID, and expired
// Any other scenario: a SideStore with nothing wrong (none at all in `no-apps`).
import { compact } from '@ipaforge/kernel'
import { StepLabel } from '@ipaforge/rpc'
import {
  fakeInstallSteps,
  quick,
  reporting,
  step
} from '@ui/services/engine/fake/fake-install-steps.ts'
import type { FakeWorld } from '@ui/services/engine/fake/fake-world.ts'
import type {
  FakeInstalledApp,
  FakeInstallState,
  FakeRepairFixes,
  FakeSideStoreState,
  ScriptedStep
} from '@ui/services/engine/fake/types.ts'
import type { SideStoreCheck } from '@ui/services/engine/types.ts'

const LATEST = '0.7.0'
const DAY_MS = 24 * 60 * 60 * 1000

const initialState = (scenario: string): FakeSideStoreState => {
  if (scenario === 'sidestore-broken')
    return {
      expiredDays: 2,
      signing: 'valid',
      ownCertificate: 'missing',
      pairing: 'missing',
      version: LATEST,
      signedBy: 'team'
    }
  if (scenario === 'sidestore-unknown')
    return {
      signing: 'unknown',
      ownCertificate: 'other',
      pairing: 'other-computer',
      version: '0.6.2',
      signedBy: 'team'
    }
  if (scenario === 'sidestore-other-team')
    return {
      expiredDays: 1,
      signing: 'unknown',
      ownCertificate: 'valid',
      pairing: 'this-computer',
      version: LATEST,
      signedBy: 'other-apple-id'
    }

  return {
    signing: 'valid',
    ownCertificate: 'valid',
    pairing: 'this-computer',
    version: LATEST,
    signedBy: 'team'
  }
}

/** The fixes a repair run plays, with the Engine's step ids. */
const repairSteps = (
  world: FakeWorld,
  input: FakeRepairFixes
): ScriptedStep<FakeInstallState>[] => {
  if (input.reinstall) return fakeInstallSteps(world)

  return [
    step(world, 'device', StepLabel.device, 1, quick),
    ...(input.profile
      ? [
          step(world, 'sign-in', StepLabel.signIn, 1, quick),
          step(world, 'team', StepLabel.team, 1, quick),
          step(world, 'register-device', StepLabel.registerDevice, 1, quick),
          step(
            world,
            'profiles-0',
            StepLabel.refreshProfiles,
            2,
            reporting({ kind: 'profiles', count: 1 })
          )
        ]
      : []),
    ...(input.pairing
      ? [
          step(
            world,
            'pairing',
            StepLabel.pairing,
            1,
            reporting({ kind: 'pairing', apps: ['SideStore'] })
          )
        ]
      : [])
  ]
}

export const createFakeSideStore = (
  world: FakeWorld,
  installed: () => Promise<readonly FakeInstalledApp[]>
) => {
  let state = initialState(world.scenario)

  return {
    check: async (): Promise<SideStoreCheck> => {
      await world.appleAnswer()
      const app = (await installed()).find((candidate) =>
        candidate.bundleId.startsWith('com.SideStore.SideStore.')
      )

      if (!app) return { locked: false, developerMode: 'on' }

      return {
        locked: false,
        developerMode: 'on',
        sideStore: compact({
          bundleId:
            state.signedBy === 'team'
              ? app.bundleId
              : 'com.SideStore.SideStore.OTHERTEAM',
          version: state.version,
          latest: LATEST,
          channel: 'stable' as const,
          signedBy: state.signedBy,
          expiresAt:
            state.expiredDays === undefined
              ? app.expiresAt
              : new Date(Date.now() - state.expiredDays * DAY_MS),
          signing: state.signing,
          ownCertificate: state.ownCertificate,
          pairing: state.pairing
        })
      }
    },
    steps: repairSteps,
    /** After a repair run: its fixes take hold. */
    repaired: (input: FakeRepairFixes) => {
      const reinstalled = input.reinstall
        ? {
            signing: 'valid' as const,
            ownCertificate: 'valid' as const,
            pairing: 'this-computer' as const,
            version: LATEST
          }
        : {}

      const { expiredDays, ...rest } = state
      const renewed = input.reinstall || input.profile

      state = {
        ...rest,
        ...reinstalled,
        ...(input.pairing ? { pairing: 'this-computer' as const } : {}),
        ...(renewed || expiredDays === undefined ? {} : { expiredDays })
      }
    }
  }
}
