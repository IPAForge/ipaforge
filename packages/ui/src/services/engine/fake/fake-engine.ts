// A stand-in Engine for the browser dev host and the UI's tests: scripted devices and accounts, and runs that play
// a scenario (see fake-scenarios.ts). It is served over the rpc memory transport, so the UI talks to it exactly
// as it talks to the real Engine over the Electron MessagePort.
import { ErrorCode, LoadstarError } from '@loadstar/kernel'
import {
  type CommandOptions,
  classify,
  type Engine,
  type InstallPlan,
  PromptKind,
  type RunHandle,
  StepLabel
} from '@loadstar/rpc'
import type { Account } from '@ui/services/engine/engine-types.ts'
import {
  FAKE_IPHONE,
  fakeCatalogApps,
  fakeCertificates,
  fakeIphoneCheck,
  fakePairingApps
} from '@ui/services/engine/fake/fake-data.ts'
import {
  createFakeDeviceFeed,
  type FakeDeviceFeed
} from '@ui/services/engine/fake/fake-devices.ts'
import {
  type FakeInstallState,
  fakeInstallSteps
} from '@ui/services/engine/fake/fake-install-steps.ts'
import type { FakeScenarioId } from '@ui/services/engine/fake/fake-scenarios.ts'
import {
  askPassword,
  completeTwoFactor
} from '@ui/services/engine/fake/fake-two-factor.ts'
import {
  createFakeWorld,
  type FakeWorld,
  forgetAccount,
  requireSession,
  teamsFor
} from '@ui/services/engine/fake/fake-world.ts'
import { startScriptedRun } from '@ui/services/engine/fake/scripted-run.ts'

export type FakeEngineOptions = {
  readonly scenario?: FakeScenarioId
  /** Connected devices; tests keep it to plug devices in and out. */
  readonly devices?: FakeDeviceFeed
  /** Pause between run events, so a run can be watched; 0 in tests. */
  readonly delayMs?: number
  /** How long Apple takes to answer a sign-in request, so the dev host shows the waiting states. */
  readonly appleDelayMs?: number
  /** Replaces that wait (tests hold Apple's answer until they release it). */
  readonly appleAnswer?: () => Promise<void>
}

type TeamQuery = { readonly accountId: string; readonly teamId?: string }

const DEFAULT_DELAY_MS = 120
const DEFAULT_APPLE_DELAY_MS = 600

const teamOf = (world: FakeWorld, { accountId, teamId }: TeamQuery) => {
  requireSession(world, accountId)
  const teams = teamsFor(world, accountId)
  const team = teams.find((candidate) => candidate.id === teamId) ?? teams[0]
  if (!team)
    throw new LoadstarError(ErrorCode.TeamRequired, { data: { accountId } })
  return team
}

const deviceStatus = async (udid: string) => {
  if (udid !== FAKE_IPHONE)
    throw new LoadstarError(ErrorCode.DeviceNotPaired, { data: { udid } })
  return fakeIphoneCheck
}

const installRun = (
  world: FakeWorld,
  input: { readonly udid: string; readonly accountId: string },
  options: CommandOptions<FakeInstallState> | undefined
) =>
  startScriptedRun<FakeInstallState>({
    pipelineId: 'installSideStore',
    steps: fakeInstallSteps(world),
    initial: { udid: input.udid, accountId: input.accountId },
    options,
    delayMs: world.delayMs
  })

type SignInState = { readonly appleId: string; readonly account?: Account }

const saveAccount = (world: FakeWorld, appleId: string): Account => {
  const account = world.accounts.find((saved) => saved.id === appleId) ?? {
    id: appleId,
    appleId,
    health: { bannedOnDevices: [] }
  }
  world.accounts = [
    ...world.accounts.filter((saved) => saved.id !== appleId),
    account
  ]
  world.signedIn.add(appleId)
  return account
}

const signInRun = (
  world: FakeWorld,
  {
    appleId,
    rememberPassword
  }: { appleId: string; rememberPassword?: boolean },
  options: CommandOptions<SignInState> | undefined
) =>
  startScriptedRun<SignInState>({
    pipelineId: 'signIn',
    steps: [
      {
        stepId: 'sign-in',
        labelKey: StepLabel.signIn,
        run: async (_state, context) => {
          const password = await askPassword(context, appleId)
          // Apple checks the password.
          await world.appleAnswer()
          if (password.length === 0 || world.scenario === 'wrong-password')
            throw new LoadstarError(ErrorCode.InvalidCredentials)
          // Apple skips the second factor for a computer it already knows.
          if (world.scenario !== 'sign-in-no-2fa')
            await completeTwoFactor(context, world.appleAnswer)
          if (rememberPassword) world.savedPasswords.add(appleId)
          return { account: saveAccount(world, appleId) }
        }
      }
    ],
    initial: { appleId },
    options,
    delayMs: world.delayMs
  })

const pairingRun = (world: FakeWorld) =>
  startScriptedRun<{ readonly placed?: readonly string[] }>({
    pipelineId: 'placePairing',
    steps: [
      {
        stepId: 'targets',
        labelKey: StepLabel.pairingTargets,
        run: async (_state, context) => ({
          placed: await context.prompt<readonly string[]>({
            kind: PromptKind.ChoosePairingApps,
            data: { apps: fakePairingApps }
          })
        })
      },
      {
        stepId: 'place',
        labelKey: StepLabel.placePairing,
        run: async () => undefined
      }
    ],
    initial: {},
    delayMs: world.delayMs
  })

/** The fake's run states are its own; the server only forwards them, so the Engine's types are asserted here. */
const asRun = <S>(handle: RunHandle<unknown>) => handle as RunHandle<S>

export const createFakeEngine = ({
  scenario = 'happy',
  delayMs = DEFAULT_DELAY_MS,
  appleDelayMs = DEFAULT_APPLE_DELAY_MS,
  appleAnswer = () =>
    new Promise<void>((resolve) => setTimeout(resolve, appleDelayMs)),
  devices = createFakeDeviceFeed(scenario === 'hot-plug')
}: FakeEngineOptions = {}): Engine => {
  const world = createFakeWorld(scenario, delayMs, appleAnswer)

  return {
    listDevices: async () => devices.list(),
    watchDevices: (listener, options) =>
      devices.watch(listener, options?.signal),
    deviceStatus,
    listAccounts: async () => world.accounts,
    signOut: async (accountId) => forgetAccount(world, accountId),
    listTeams: async (accountId) => {
      requireSession(world, accountId)
      return teamsFor(world, accountId)
    },
    catalogApps: async () => fakeCatalogApps,
    recommendedChannel: async () => 'stable',
    appIdQuota: async (query) => ({
      team: teamOf(world, query),
      appIds: [],
      quota: { max: 10, available: 8 }
    }),
    listCertificates: async (query) => ({
      team: teamOf(world, query),
      certificates: fakeCertificates.map((certificate) => ({
        ...certificate,
        expiresAt: new Date(certificate.expiresAt)
      }))
    }),
    planInstall: async (input) =>
      ({
        team: teamOf(world, input),
        certificate: { stored: true, reusable: true, onTeam: 1 },
        sharesCertificate: true
      }) as unknown as InstallPlan,
    installSideStore: (input, options) =>
      asRun(installRun(world, input, options as never)),
    installApps: (input, options) =>
      asRun(installRun(world, input, options as never)),
    placePairing: () => asRun(pairingRun(world)),
    signIn: (input, options) =>
      asRun(signInRun(world, input, options as never)),
    classify
  }
}
