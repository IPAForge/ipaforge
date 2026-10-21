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
  type RefreshAppsInput,
  type RunEvent,
  type RunHandle
} from '@ipaforge/installer'
import { compact, ErrorCode, IPAForgeError } from '@ipaforge/kernel'

export type FakeState = {
  readonly apps: readonly AppSource[]
  readonly prepared?: boolean
  readonly teamId?: string
  readonly installed?: boolean
}

export const TEAMS = [{ id: 'TEAM1', name: 'Free team' }]

export const ANISETTE = {
  servers: [
    {
      name: 'SideStore',
      address: 'https://ani.sidestore.io',
      source: 'list' as const
    }
  ],
  choice: { mode: 'automatic' as const },
  skipped: []
}

const flow = (control: FakeControl) =>
  pipeline<FakeState>('fake.install', [
    {
      id: 'prepare',
      labelKey: 'step.prepare',
      run: async (_state, context) => {
        context.progress(0.5, { phase: 'reading' })
        context.detail({
          kind: 'app',
          name: 'My App',
          version: '1.2',
          extensions: 2
        })
        context.detail({ kind: 'pairing', apps: ['SideStore', 'StikDebug'] })
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
          throw new IPAForgeError(ErrorCode.InstallFailed, {
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
      throw new IPAForgeError(ErrorCode.Unexpected, {
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
    decline: () => take().reject(new IPAForgeError(ErrorCode.PromptCancelled)),
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
  readonly refreshInputs: RefreshAppsInput[]
  readonly repairInputs: unknown[]
  readonly signIns: unknown[]
  readonly signedOut: string[]
  readonly paired: string[]
  /** Device-watch listeners the server holds. */
  readonly watchers: Set<(event: DeviceWatchEvent) => void>
}

export const createFakeEngine = () => {
  const control: FakeControl = {
    installFailures: 0,
    runs: [],
    planned: [],
    appInputs: [],
    refreshInputs: [],
    repairInputs: [],
    signIns: [],
    signedOut: [],
    paired: [],
    watchers: new Set()
  }
  const engine = {
    listDevices: async () => [{ udid: 'UDID1', connection: 'USB' }],
    systemCheck: async () => ({
      deviceService: 'ok' as const,
      apple: true,
      clockOk: true,
      anisette: { server: 'SideStore', tried: 3 }
    }),
    deviceStatus: async (udid: string) => {
      throw new IPAForgeError(ErrorCode.DeviceLocked, {
        data: { udid },
        cause: new IPAForgeError(ErrorCode.Offline, {
          message: 'lockdown went away'
        })
      })
    },
    pairDevice: async (udid: string) => {
      control.paired.push(udid)
      return { info: { udid, name: 'iPhone' }, locked: false }
    },
    listAccounts: async () => [{ id: 'acct', appleId: 'someone@example.com' }],
    canSaveAccounts: async () => true,
    anisetteServers: async () => ANISETTE,
    chooseAnisetteServer: async () => ANISETTE,
    addAnisetteServer: async () => ANISETTE,
    updateAnisetteServer: async () => ANISETTE,
    removeAnisetteServer: async () => ANISETTE,
    testAnisetteServer: async (address: string) => ({
      address,
      ok: true,
      latencyMs: 120
    }),
    updateAnisetteServerList: async () => ANISETTE,
    revokeCertificate: async () => undefined,
    deleteAppId: async () => undefined,
    appGroups: async () => ({ team: TEAMS[0], groups: [] }),
    registeredDevices: async () => ({
      team: TEAMS[0],
      devices: [{ udid: 'UDID1', name: 'iPhone' }]
    }),
    deviceProfiles: async () => [
      {
        uuid: 'P1',
        name: 'Profile',
        bundleId: 'com.example.app',
        expiresAt: new Date('2026-11-01T00:00:00Z'),
        isUsed: true
      }
    ],
    removeDeviceProfiles: async () => undefined,
    pairingFiles: async () => [
      {
        bundleId: 'com.SideStore.SideStore.TEAM',
        name: 'SideStore',
        kind: 'known' as const,
        classic: 'this-computer' as const,
        placedAt: new Date('2026-10-20T00:00:00Z'),
        remote: 'accepted' as const
      }
    ],
    placeAppPairing: async () => undefined,
    removeAppPairing: async () => undefined,
    newRemotePairing: async () => undefined,
    devicePairingFile: async () => '<plist/>',
    exportCertificate: async () => new Uint8Array([0x30, 0x01]),
    importCertificate: async () => ({ serialNumber: 'SERIAL1' }),
    listSources: async () => [],
    sourceApps: async () => [],
    checkSource: async (url: string) => ({
      url,
      content: { name: 'Source', apps: [], skipped: 0 }
    }),
    addSource: async (url: string) => ({
      id: url,
      kind: 'altstore' as const,
      url,
      builtin: false,
      enabled: true,
      name: 'Source',
      appCount: 0,
      skipped: 0
    }),
    removeSource: async () => undefined,
    setSourceEnabled: async () => undefined,
    refreshSources: async () => [],
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
    refreshApps: (
      input: RefreshAppsInput,
      options?: CommandOptions<FakeState>
    ) => {
      control.refreshInputs.push(input)
      return startRun(control, { apps: input.apps }, options)
    },
    repairSideStore: (input: unknown, options?: CommandOptions<FakeState>) => {
      control.repairInputs.push(input)
      return startRun(control, { apps: [] }, options)
    },
    checkSideStore: async () => ({
      locked: false,
      developerMode: 'on',
      sideStore: {
        bundleId: 'com.SideStore.SideStore.TEAM',
        pairing: 'missing'
      }
    }),
    refreshPlan: async (query: { bundleIds: readonly string[] }) =>
      query.bundleIds.map((bundleId) => ({ bundleId, kind: 'profile' })),
    installedSource: async (_udid: string, bundleId: string) => ({
      kind: 'installed',
      file: { name: `${bundleId}.ipa` },
      record: { bundleId }
    }),
    installSideStore: (_input: unknown, options?: CommandOptions<FakeState>) =>
      startRun(
        control,
        { apps: [{ kind: 'catalog', appId: 'sidestore' }] },
        options
      ),
    placePairing: () => {
      throw new IPAForgeError(ErrorCode.TeamRequired, {
        data: { accountId: 'acct' }
      })
    },
    signIn: (input: unknown, options?: CommandOptions<FakeState>) => {
      control.signIns.push(input)
      return startRun(control, { apps: [] }, options)
    },
    signOut: async (accountId: string) => {
      if (accountId !== 'acct')
        throw new IPAForgeError(ErrorCode.AccountNotFound, {
          data: { id: accountId }
        })
      control.signedOut.push(accountId)
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
