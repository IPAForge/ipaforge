// A stand-in Engine for the browser dev host and the UI's tests: scripted devices and accounts, and runs that play
// a scenario (see fake-scenarios.ts). It is served over the rpc memory transport, so the UI talks to it exactly
// as it talks to the real Engine over the Electron MessagePort.
import { ErrorCode, IPAForgeError } from '@ipaforge/kernel'
import {
  type CommandOptions,
  classify,
  type Engine,
  type InstallPlan,
  PromptKind,
  type RunHandle,
  StepLabel
} from '@ipaforge/rpc'
import { fakeAppFor, fakePlanFor } from '@ui/services/engine/fake/fake-apps.ts'
import { fakeAppsSteps } from '@ui/services/engine/fake/fake-apps-steps.ts'
import {
  fakeCatalogApps,
  fakeCertificates,
  fakeIphoneCheck,
  fakePairingApps,
  showcaseDevices
} from '@ui/services/engine/fake/fake-data.ts'
import { createFakeDeviceStates } from '@ui/services/engine/fake/fake-device-states.ts'
import { createFakeDeviceFeed } from '@ui/services/engine/fake/fake-devices.ts'
import { fakeInstallSteps } from '@ui/services/engine/fake/fake-install-steps.ts'
import { createFakeInstalled } from '@ui/services/engine/fake/fake-installed.ts'
import { createFakeSources } from '@ui/services/engine/fake/fake-sources.ts'
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
import type {
  FakeAppSource,
  FakeEngineOptions,
  FakeInstallState,
  FakeRunSource,
  FakeSignInState,
  TeamQuery
} from '@ui/services/engine/fake/types.ts'
import type { Account } from '@ui/services/engine/types.ts'

/** Pause between run events in the browser dev host. */
export const DEFAULT_DELAY_MS = 120
const DEFAULT_APPLE_DELAY_MS = 600

const teamOf = (world: FakeWorld, { accountId, teamId }: TeamQuery) => {
  requireSession(world, accountId)
  const teams = teamsFor(world, accountId)
  const team = teams.find((candidate) => candidate.id === teamId) ?? teams[0]
  if (!team)
    throw new IPAForgeError(ErrorCode.TeamRequired, { data: { accountId } })
  return team
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

/** The Preload page's apps, in order, as the fake knows them (and for a refresh, the apps getting new profiles). */
const appsRun = (
  world: FakeWorld,
  input: {
    readonly udid: string
    readonly accountId: string
    readonly apps: readonly unknown[]
    readonly profiles?: readonly string[]
  },
  options: CommandOptions<FakeInstallState> | undefined
) =>
  startScriptedRun<FakeInstallState>({
    pipelineId: input.profiles ? 'refreshApps' : 'installApps',
    steps: fakeAppsSteps(
      world,
      input.apps.map((source) => fakeAppFor(source as FakeAppSource)),
      input.profiles?.length
    ),
    initial: { udid: input.udid, accountId: input.accountId },
    options,
    delayMs: world.delayMs
  })

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
  options: CommandOptions<FakeSignInState> | undefined
) =>
  startScriptedRun<FakeSignInState>({
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
            throw new IPAForgeError(ErrorCode.InvalidCredentials)
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
  devices = createFakeDeviceFeed(
    scenario === 'hot-plug',
    scenario === 'devices' ? showcaseDevices : undefined
  )
}: FakeEngineOptions = {}): Engine => {
  const world = createFakeWorld(scenario, delayMs, appleAnswer)
  const deviceStates = createFakeDeviceStates(scenario)
  const { refreshed, updated, reinstalled, ...installed } =
    createFakeInstalled(scenario)

  // What a finished run did to the installed apps: refreshed ones get 7 more days, updated ones their version.
  const applied = <H extends RunHandle<unknown>>(
    handle: H,
    input: {
      readonly apps: readonly FakeRunSource[]
      readonly profiles?: readonly string[]
    }
  ): H => {
    void handle.result.then((result) => {
      if (result.status !== 'completed') return
      refreshed([
        ...(input.profiles ?? []),
        ...input.apps.flatMap((app) =>
          app.kind === 'installed' ? [app.record.bundleId] : []
        )
      ])
      reinstalled(
        input.apps.flatMap((app) => (app.kind === 'catalog' ? [app.appId] : []))
      )
      updated(
        input.apps.flatMap((app) =>
          app.kind === 'file' && app.origin?.kind === 'url'
            ? [app.origin.url]
            : []
        )
      )
    })

    return handle
  }

  return {
    listDevices: async () => devices.list(),
    watchDevices: (listener, options) =>
      devices.watch(listener, options?.signal),
    deviceStatus: deviceStates.status,
    pairDevice: deviceStates.pair,
    ...installed,
    ...createFakeSources(
      scenario,
      () => new Promise<void>((resolve) => setTimeout(resolve, delayMs))
    ),
    listAccounts: async () => world.accounts,
    canSaveAccounts: async () => world.scenario !== 'no-keychain',
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
    planInstall: async (input) => {
      const team = teamOf(world, input)

      return fakePlanFor(
        fakeAppFor(input.source as FakeAppSource),
        team,
        fakeIphoneCheck.info.productVersion
      ) as unknown as InstallPlan
    },
    installSideStore: (input, options) =>
      asRun(installRun(world, input, options as never)),
    installApps: (input, options) =>
      asRun(applied(appsRun(world, input, options as never), input)),
    refreshApps: (input, options) =>
      asRun(applied(appsRun(world, input, options as never), input)),
    placePairing: () => asRun(pairingRun(world)),
    signIn: (input, options) =>
      asRun(signInRun(world, input, options as never)),
    classify
  }
}
