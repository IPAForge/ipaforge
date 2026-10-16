// An Engine stand-in for RPC tests: canned query answers and one real pipeline (prepare → choose a team → install)
// behind a run handle that behaves like the Engine's (replayed events, prompts answered through the handle).
import {
  type AppSource,
  type CommandOptions,
  classify,
  type DeviceWatchEvent,
  type Engine,
  type InstallAppsInput,
  PromptKind,
  type PromptRequest,
  pipeline,
  type RunEvent,
  type RunHandle
} from '@loadstar/installer'
import { compact, ErrorCode, LoadstarError } from '@loadstar/kernel'

export type FakeState = {
  readonly apps: readonly AppSource[]
  readonly prepared?: boolean
  readonly teamId?: string
  readonly installed?: boolean
}

export const TEAMS = [{ id: 'TEAM1', name: 'Free team' }]

const flow = (control: FakeControl) =>
  pipeline<FakeState>('fake.install', [
    {
      id: 'prepare',
      labelKey: 'step.prepare',
      run: async (_state, context) => {
        context.progress(0.5, { phase: 'reading' })
        return { prepared: true }
      }
    },
    {
      id: 'choose-team',
      labelKey: 'step.team',
      run: async (_state, context) => ({
        teamId: await context.prompt<string>({
          kind: PromptKind.ChooseTeam,
          data: { teams: TEAMS }
        })
      })
    },
    {
      id: 'install',
      labelKey: 'step.install',
      run: async () => {
        if (control.installFailures > 0) {
          control.installFailures--
          throw new LoadstarError(ErrorCode.InstallFailed, {
            data: { bundleId: 'com.example.app' }
          })
        }
        return { installed: true }
      }
    }
  ])

/** A RunHandle like the Engine's, over `pipeline.run`. */
const startRun = (
  control: FakeControl,
  initial: FakeState,
  options: CommandOptions<FakeState> = {}
) => {
  const history: RunEvent[] = []
  const listeners = new Set<(event: RunEvent) => void>()
  const emit = (event: RunEvent) => {
    history.push(event)
    for (const listener of listeners) listener(event)
  }
  let waiting:
    | {
        request: PromptRequest
        resolve: (answer: unknown) => void
        reject: (error: unknown) => void
      }
    | undefined
  const ask = (request: PromptRequest, signal: AbortSignal) =>
    new Promise<unknown>((resolve, reject) => {
      waiting = { request, resolve, reject }
      signal.addEventListener('abort', () => reject(signal.reason), {
        once: true
      })
      emit({ type: 'prompt', request })
    })
  const take = () => {
    const current = waiting
    if (!current)
      throw new LoadstarError(ErrorCode.Unexpected, {
        message: 'no prompt is waiting'
      })
    waiting = undefined
    return current
  }
  const signal = options.signal ?? new AbortController().signal
  const handle: RunHandle<FakeState> = {
    subscribe: (listener) => {
      for (const event of history) listener(event)
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    pending: () => waiting?.request,
    answer: (answer) => take().resolve(answer),
    decline: () => take().reject(new LoadstarError(ErrorCode.PromptCancelled)),
    cancel: () => {},
    result: flow(control).run(
      initial,
      compact({ onEvent: emit, onPrompt: ask, signal, resume: options.resume })
    )
  }
  control.runs.push({ options, handle })
  return handle
}

export type FakeControl = {
  installFailures: number
  readonly runs: {
    readonly options: CommandOptions<FakeState>
    readonly handle: RunHandle<FakeState>
  }[]
  readonly planned: unknown[]
  readonly appInputs: InstallAppsInput[]
  readonly signIns: unknown[]
  /** Device-watch listeners the server holds. */
  readonly watchers: Set<(event: DeviceWatchEvent) => void>
}

export const createFakeEngine = () => {
  const control: FakeControl = {
    installFailures: 0,
    runs: [],
    planned: [],
    appInputs: [],
    signIns: [],
    watchers: new Set()
  }
  const engine = {
    listDevices: async () => [{ udid: 'UDID1', connection: 'USB' }],
    deviceStatus: async (udid: string) => {
      throw new LoadstarError(ErrorCode.DeviceLocked, {
        data: { udid },
        cause: new LoadstarError(ErrorCode.Offline, {
          message: 'lockdown went away'
        })
      })
    },
    listAccounts: async () => [{ id: 'acct', appleId: 'someone@example.com' }],
    listTeams: async () => TEAMS,
    catalogApps: async () => [],
    recommendedChannel: async (appId: string, iosVersion?: string) =>
      iosVersion === '26.4' ? 'nightly' : appId,
    appIdQuota: async (query: unknown) => ({ query }),
    listCertificates: async () => ({
      team: TEAMS[0],
      certificates: [{ serialNumber: 'S1', expiresAt: new Date(0) }]
    }),
    planInstall: async (input: { source: AppSource }) => {
      control.planned.push(input)
      return { kind: input.source.kind }
    },
    installApps: (
      input: InstallAppsInput,
      options?: CommandOptions<FakeState>
    ) => {
      control.appInputs.push(input)
      return startRun(control, { apps: input.apps }, options)
    },
    installSideStore: (_input: unknown, options?: CommandOptions<FakeState>) =>
      startRun(
        control,
        { apps: [{ kind: 'catalog', appId: 'sidestore' }] },
        options
      ),
    placePairing: () => {
      throw new LoadstarError(ErrorCode.TeamRequired, {
        data: { accountId: 'acct' }
      })
    },
    signIn: (input: unknown, options?: CommandOptions<FakeState>) => {
      control.signIns.push(input)
      return startRun(control, { apps: [] }, options)
    },
    watchDevices: (listener: (event: DeviceWatchEvent) => void) => {
      control.watchers.add(listener)
      listener({
        type: 'devices',
        devices: [{ udid: 'UDID1', deviceId: 1, connectionType: 'usb' }]
      })
      return () => control.watchers.delete(listener)
    },
    classify
  }

  return { engine: engine as unknown as Engine, control }
}
