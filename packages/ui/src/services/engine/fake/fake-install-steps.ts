// The fake installSideStore: the Engine's fifteen steps with their ids, labels and weights, playing the
// scenario's prompts, retries and failure.
import { ErrorCode, IPAForgeError } from '@ipaforge/kernel'
import {
  PromptKind,
  StepLabel,
  type StepDetail as StepReport
} from '@ipaforge/rpc'
import {
  FAKE_IPA_SIZE,
  FAKE_IPHONE,
  fakeCertificates,
  fakeIphoneCheck,
  fakeRemovableApps
} from '@ui/services/engine/fake/fake-data.ts'
import {
  askPassword,
  completeTwoFactor
} from '@ui/services/engine/fake/fake-two-factor.ts'
import {
  type FakeWorld,
  failOnce,
  teamsFor
} from '@ui/services/engine/fake/fake-world.ts'
import type {
  FakeInstallState,
  ScriptedStep,
  ScriptedStepContext,
  StepBody
} from '@ui/services/engine/fake/types.ts'

const TICKS = 8
const RETRY_DELAY_MS = 2000
const RETRIES = 2

const quick: StepBody = async () => undefined

/** Reports progress in ticks; `detail` describes each tick. */
const ticking =
  (detail?: (fraction: number) => Readonly<Record<string, unknown>>) =>
  async (context: ScriptedStepContext) => {
    for (let tick = 1; tick <= TICKS; tick++) {
      const fraction = tick / TICKS
      await context.progress(fraction, detail?.(fraction))
    }
  }

const bytes = (fraction: number) => ({
  received: Math.round(FAKE_IPA_SIZE * fraction),
  total: FAKE_IPA_SIZE
})

const download =
  (world: FakeWorld): StepBody =>
  async (_state, context) => {
    if (world.scenario === 'retry' && !world.failed.has('download-0')) {
      world.failed.add('download-0')
      for (let attempt = 1; attempt <= RETRIES; attempt++) {
        await context.progress(0.4, bytes(0.4))
        await context.retrying(attempt, RETRY_DELAY_MS, ErrorCode.Offline)
      }
    }
    await ticking(bytes)(context)
    context.detail({ kind: 'download', bytes: FAKE_IPA_SIZE, cached: false })
    return undefined
  }

const checkDevice: StepBody = async (state, context) => {
  if (state.udid !== FAKE_IPHONE)
    throw new IPAForgeError(ErrorCode.DeviceNotPaired, {
      data: { udid: state.udid }
    })
  context.detail({
    kind: 'device',
    productType: fakeIphoneCheck.info.productType,
    iosVersion: fakeIphoneCheck.info.productVersion
  })
  return undefined
}

/** A step that only reports what it did. */
const reporting =
  (report: StepReport): StepBody =>
  async (_state, context) => {
    context.detail(report)
    return undefined
  }

const signIn =
  (world: FakeWorld): StepBody =>
  async (state, context) => {
    if (world.signedIn.has(state.accountId)) {
      context.detail({ kind: 'session', how: 'reused' })
      return undefined
    }
    await askPassword(context, state.accountId)
    await world.appleAnswer()
    await completeTwoFactor(context, world.appleAnswer)
    world.signedIn.add(state.accountId)
    context.detail({ kind: 'session', how: 'signed-in' })
    return undefined
  }

const chooseTeam =
  (world: FakeWorld): StepBody =>
  async (state, context) => {
    const teams = teamsFor(world, state.accountId)
    const [only] = teams
    const teamId =
      state.teamId ??
      (teams.length === 1 && only
        ? only.id
        : await context.prompt<string>({
            kind: PromptKind.ChooseTeam,
            data: { teams }
          }))

    const team = teams.find((candidate) => candidate.id === teamId)
    if (team)
      context.detail({ kind: 'team', name: team.name, isFree: team.isFree })

    return { teamId, isFreeTeam: team?.isFree ?? true }
  }

const certificate =
  (world: FakeWorld): StepBody =>
  async (_state, context) => {
    const isFull = world.scenario === 'certificate-limit'
    if (isFull)
      await context.prompt<string>({
        kind: PromptKind.RevokeCertificate,
        data: { certificates: fakeCertificates }
      })
    context.detail({ kind: 'certificate', how: isFull ? 'replaced' : 'reused' })
    return undefined
  }

const freeApps =
  (world: FakeWorld): StepBody =>
  async (_state, context) => {
    if (world.scenario !== 'free-app-limit') {
      context.detail({ kind: 'free-apps', used: 1, limit: 3 })
      return undefined
    }
    const removed = await context.prompt<string>({
      kind: PromptKind.ChooseAppToRemove,
      data: {
        limit: 3,
        apps: fakeRemovableApps,
        installing: 'com.SideStore.SideStore'
      }
    })
    const app = fakeRemovableApps.find(
      (candidate) => candidate.bundleId === removed
    )
    context.detail({
      kind: 'free-apps',
      used: 2,
      limit: 3,
      removed: app?.name ?? removed
    })
    return undefined
  }

const progressing: StepBody = async (_state, context) => {
  await ticking()(context)
  return undefined
}

/** A step that first plays the scenario's failure, if it is this one. */
const step = (
  world: FakeWorld,
  stepId: string,
  labelKey: string,
  weight: number,
  body: StepBody,
  skip?: (state: FakeInstallState) => boolean
): ScriptedStep<FakeInstallState> => ({
  stepId,
  labelKey,
  weight,
  ...(skip ? { skip } : {}),
  run: async (state, context) => {
    failOnce(world, stepId, state)
    return body(state, context)
  }
})

export const fakeInstallSteps = (
  world: FakeWorld
): ScriptedStep<FakeInstallState>[] => [
  step(world, 'device', StepLabel.device, 1, checkDevice),
  step(
    world,
    'resolve-0',
    StepLabel.resolve,
    1,
    reporting({ kind: 'release', version: '0.7.0', channel: 'stable' })
  ),
  step(world, 'download-0', StepLabel.download, 6, download(world)),
  step(
    world,
    'inspect-0',
    StepLabel.inspect,
    1,
    reporting({
      kind: 'app',
      name: 'SideStore',
      version: '0.7.0',
      extensions: 1
    })
  ),
  step(world, 'sign-in', StepLabel.signIn, 1, signIn(world)),
  step(world, 'team', StepLabel.team, 1, chooseTeam(world)),
  step(
    world,
    'register-device',
    StepLabel.registerDevice,
    1,
    reporting({ kind: 'device-registration', isNew: false })
  ),
  step(world, 'certificate', StepLabel.certificate, 1, certificate(world)),
  step(
    world,
    'app-ids',
    StepLabel.appIds,
    1,
    reporting({ kind: 'app-ids', created: 2, reused: 0, left: 6 })
  ),
  step(
    world,
    'free-apps-0',
    StepLabel.freeApps,
    1,
    freeApps(world),
    (state) => state.isFreeTeam === false
  ),
  step(
    world,
    'provision-0',
    StepLabel.provision,
    2,
    reporting({ kind: 'profiles', count: 2 })
  ),
  step(world, 'sign-0', StepLabel.sign, 4, progressing),
  step(world, 'install-0', StepLabel.install, 6, progressing),
  step(
    world,
    'pairing',
    StepLabel.pairing,
    1,
    reporting({ kind: 'pairing', apps: ['SideStore'] })
  ),
  step(world, 'remember', StepLabel.remember, 1, quick)
]
