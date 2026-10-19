// In-memory stand-ins for the contexts the installer orchestrates, at the level of their public interfaces.

import type { ScratchStore } from '@installer/domain/ports/scratch-store.ts'
import type { IpaSigner, SignRequest } from '@installer/domain/ports/types.ts'
import type {
  AppIdPlan,
  AppleAccounts,
  AppleSession,
  CertificateIdentity,
  DeveloperServices,
  DevelopmentCertificate,
  ProvisionRequest,
  SavedAccount,
  Team,
  TwoFactorChallenge,
  TwoFactorMethod
} from '@ipaforge/apple'
import type { Catalog, ResolvedRelease } from '@ipaforge/catalog'
import type {
  AppFileTarget,
  DeviceCheck,
  DeviceHandle,
  DeviceManager,
  DeviceProfile,
  InstalledApp,
  InstallIpaOptions,
  PairingTarget
} from '@ipaforge/device'
import {
  bytesFileSource,
  createDict,
  ErrorCode,
  type FileSource,
  IPAForgeError,
  readBody,
  type SecretStore
} from '@ipaforge/kernel'
import type { CodeBundle, IpaInspection } from '@ipaforge/signer'

export const UDID = '00008110-000A1B2C3D4E5F60'
export const ACCOUNT = 'someone@example.com'
export const FREE_TEAM: Team = {
  id: 'TEAM000001',
  name: 'Personal Team',
  isFree: true
}
export const OTHER_TEAM: Team = {
  id: 'TEAM000002',
  name: 'Company',
  isFree: false
}
export const SHA256 = 'a'.repeat(64)

export const memorySecrets = (): SecretStore & {
  readonly values: Map<string, Uint8Array>
} => {
  const values = new Map<string, Uint8Array>()

  return {
    values,
    get: async (key) => values.get(key),
    set: async (key, value) => {
      values.set(key, value)
    },
    delete: async (key) => {
      values.delete(key)
    }
  }
}

export const memoryScratch = (): ScratchStore & {
  readonly keys: Set<string>
} => {
  const keys = new Set<string>()

  return {
    keys,
    put: async (key, stream) => {
      keys.add(key)
      const body = await readBody({ status: 200, headers: {}, body: stream })

      return bytesFileSource(key, body)
    },
    has: async (key) => keys.has(key),
    delete: async (key) => {
      keys.delete(key)
    }
  }
}

// --- device -------------------------------------------------------------------------------------------------

export type FakeDeviceOptions = {
  /** How the device is reached (default `usb`). */
  connection?: 'usb' | 'network'
  locked?: boolean
  developerMode?: DeviceCheck['developerMode']
  profiles?: DeviceProfile[]
  installed?: Map<string, InstalledApp>
  /** Errors thrown by successive installs (undefined = success). */
  installErrors?: (IPAForgeError | undefined)[]
  pairingTargets?: PairingTarget[]
  productVersion?: string
  deviceClass?: string
}

export const profile = (
  uuid: string,
  teamId: string,
  bundleId: string
): DeviceProfile => ({
  uuid,
  name: uuid,
  teamId,
  applicationIdentifier: `${teamId}.${bundleId}`,
  raw: new Uint8Array()
})

export const installedApp = (bundleId: string, name?: string): InstalledApp =>
  name === undefined
    ? { bundleId, raw: createDict() }
    : { bundleId, name, raw: createDict() }

export const fakeDevices = (options: FakeDeviceOptions = {}) => {
  const installed = options.installed ?? new Map<string, InstalledApp>()
  let profiles = options.profiles ?? []
  const installErrors = [...(options.installErrors ?? [])]
  const calls = {
    opened: 0,
    openOptions: [] as unknown[],
    closed: 0,
    installs: [] as FileSource[],
    uninstalled: [] as string[],
    removedProfiles: [] as string[],
    placed: [] as AppFileTarget[][]
  }
  const handle = {
    device: {
      udid: UDID,
      deviceId: 1,
      connectionType: options.connection ?? ('usb' as const)
    },
    check: async (): Promise<DeviceCheck> => ({
      info: {
        udid: UDID,
        name: 'Test iPhone',
        productType: 'iPhone1,1',
        productVersion: options.productVersion ?? '18.0',
        buildVersion: '1',
        deviceClass: options.deviceClass ?? 'iPhone'
      },
      locked: options.locked ?? false,
      developerMode: options.developerMode ?? 'on',
      activated: true
    }),
    installIpa: async (file: FileSource, install?: InstallIpaOptions) => {
      install?.onProgress?.({ stage: 'uploading', percent: 0, stagePercent: 0 })
      install?.onProgress?.({
        stage: 'uploading',
        percent: 50,
        stagePercent: 100,
        sent: 2,
        total: 2
      })
      const error = installErrors.shift()
      if (error) throw error
      install?.onProgress?.({
        stage: 'installing',
        percent: 75,
        stagePercent: 50,
        status: 'VerifyingApplication'
      })
      install?.onProgress?.({ stage: 'done', percent: 100, stagePercent: 100 })
      calls.installs.push(file)
    },
    uninstall: async (bundleId: string) => {
      calls.uninstalled.push(bundleId)
      installed.delete(bundleId)
    },
    listProfiles: async () => profiles,
    removeProfile: async (uuid: string) => {
      calls.removedProfiles.push(uuid)
      profiles = profiles.filter((candidate) => candidate.uuid !== uuid)
    },
    lookupApps: async (bundleIds: readonly string[]) =>
      new Map(
        [...installed].filter(([bundleId]) => bundleIds.includes(bundleId))
      ),
    pairingTargets: async () => options.pairingTargets ?? [],
    placePairingFile: async (targets: readonly AppFileTarget[]) => {
      calls.placed.push([...targets])
      return targets
    },
    appFileStatus: async (targets: readonly AppFileTarget[]) =>
      targets.map((target) => ({
        target,
        exists: target.path.includes('Legacy')
      })),
    close: async () => {
      calls.closed++
    }
  }
  const manager = {
    listDevices: async () => [
      { udid: UDID, deviceId: 1, connectionType: 'usb' as const }
    ],
    open: async (_udid: string, openOptions?: unknown) => {
      calls.opened++
      calls.openOptions.push(openOptions)
      return handle as unknown as DeviceHandle
    }
  } as unknown as DeviceManager

  return { manager, calls, installed }
}

// --- apple --------------------------------------------------------------------------------------------------

export const session: AppleSession = {
  appleId: ACCOUNT,
  adsid: 'adsid',
  idmsToken: 'token',
  sessionKey: new Uint8Array(),
  cookie: new Uint8Array(),
  anisetteServer: 'https://anisette.example'
}

export type FakeAppleOptions = {
  teams?: Team[]
  rememberedTeam?: string
  resume?: () => Promise<Awaited<ReturnType<AppleAccounts['resume']>>>
  signIn?: () => Promise<Awaited<ReturnType<AppleAccounts['signIn']>>>
  /** Certificates already on the team, made by other tools. */
  existingCertificates?: DevelopmentCertificate[]
  maxCertificates?: number
  appIdPlan?: Partial<AppIdPlan>
  /** The session saved for the account (default `session`; null = none saved). */
  savedSession?: AppleSession | null
  /** Devices already registered on the team. */
  registeredDevices?: string[]
}

export const certificateFor = (
  serialNumber: string
): DevelopmentCertificate => ({
  serialNumber,
  machineName: 'IPAForge',
  machineId: `machine-${serialNumber}`,
  content: new Uint8Array([0x30, serialNumber.length])
})

export const twoFactorChallenge = (
  acceptedCode: string,
  { refuseRequests = false } = {}
): TwoFactorChallenge & {
  readonly codes: string[]
  /** Every new code asked for, by method. */
  readonly sent: TwoFactorMethod[]
  readonly submittedWith: TwoFactorMethod[]
} => {
  const codes: string[] = []
  const sent: TwoFactorMethod[] = []
  const submittedWith: TwoFactorMethod[] = []

  return {
    codes,
    sent,
    submittedWith,
    requested: 'trusted_device',
    methods: async () => ({
      trustedDevice: true,
      phones: [{ id: 7, number: '+40 ••• ••• •12' }],
      codeLength: 6,
      legacy: false,
      securityKeysOnly: false
    }),
    requestCode: async (method) => {
      sent.push(method)
      if (refuseRequests)
        throw new IPAForgeError(ErrorCode.RateLimited, { message: 'too many' })
    },
    submitCode: async (method, code) => {
      submittedWith.push(method)
      codes.push(code)
      if (code !== acceptedCode)
        throw new IPAForgeError(ErrorCode.TwoFactorInvalidCode)
      return session
    }
  }
}

export const fakeApple = (options: FakeAppleOptions = {}) => {
  const teams = options.teams ?? [FREE_TEAM]
  let account: SavedAccount = {
    id: ACCOUNT,
    appleId: ACCOUNT,
    health: { bannedOnDevices: [] },
    ...(options.rememberedTeam ? { teamId: options.rememberedTeam } : {})
  }
  const certificates = [...(options.existingCertificates ?? [])]
  const calls = {
    /** Sessions opened (resumed or signed in): any Apple call starts with one. */
    sessions: 0,
    created: [] as string[],
    revoked: [] as string[],
    registered: [] as string[],
    provisioned: [] as ProvisionRequest[],
    banned: [] as string[],
    saved: 0,
    savedOptions: [] as unknown[],
    removed: [] as string[]
  }
  let serial = 0

  const ensureCertificate: DeveloperServices['ensureCertificate'] = async (
    _team,
    { stored }
  ) => {
    const reused =
      stored &&
      certificates.find(
        (c) => c.serialNumber === stored.certificate.serialNumber
      )
    if (stored && reused)
      return { certificate: reused, privateKey: stored.privateKey }
    if (certificates.length >= (options.maxCertificates ?? 2)) {
      throw new IPAForgeError(ErrorCode.CertificateLimit, {
        data: {
          certificates: certificates.map((c) => ({
            serialNumber: c.serialNumber,
            machineName: 'Other'
          }))
        }
      })
    }
    const certificate = certificateFor(`SERIAL${++serial}`)
    certificates.push(certificate)
    calls.created.push(certificate.serialNumber)
    return {
      certificate,
      privateKey: new Uint8Array([serial])
    } satisfies CertificateIdentity
  }

  const registeredDevices = [...(options.registeredDevices ?? [])]
  const developer = {
    teams: async () => teams,
    devices: async () =>
      [...registeredDevices, ...calls.registered].map((udid) => ({ udid })),
    registerDevice: async (_team: Team, udid: string) => {
      calls.registered.push(udid)
      return { udid }
    },
    ensureCertificate,
    revokeCertificate: async (_team: Team, serialNumber: string) => {
      calls.revoked.push(serialNumber)
      certificates.splice(
        certificates.findIndex((c) => c.serialNumber === serialNumber),
        1
      )
    },
    certificates: async () => certificates,
    appIds: async () => ({ appIds: [], quota: { available: 10, max: 10 } }),
    planAppIds: async (
      _team: Team,
      identifiers: readonly string[]
    ): Promise<AppIdPlan> => ({
      reuse: [],
      create: identifiers,
      available: 10,
      enough: true,
      ...options.appIdPlan
    }),
    provisionApp: async (request: ProvisionRequest) => {
      calls.provisioned.push(request)
      request.onProgress?.({ task: 'team', done: 2, total: 2, fraction: 0.5 })
      request.onProgress?.({
        task: 'profiles',
        done: request.bundles.length,
        total: request.bundles.length,
        fraction: 1
      })
      return {
        appIds: new Map(),
        profiles: new Map(
          request.bundles.map((b) => [b.identifier, new Uint8Array([1])])
        ),
        plan: { reuse: [], create: [], available: 10, enough: true }
      }
    }
  } as unknown as DeveloperServices

  const apple = {
    resume: async () => {
      calls.sessions++
      return options.resume
        ? options.resume()
        : { kind: 'signed_in' as const, session }
    },
    signIn: async () => {
      calls.sessions++
      return options.signIn
        ? options.signIn()
        : { kind: 'signed_in' as const, session }
    },
    developer: () => developer,
    markBanned: async (_id: string, udid: string) => {
      calls.banned.push(udid)
    },
    accounts: {
      list: async () => [account],
      session: async () =>
        options.savedSession === null
          ? undefined
          : (options.savedSession ?? session),
      remove: async (id: string) => {
        calls.removed.push(id)
      },
      save: async (_session: unknown, options?: unknown) => {
        calls.saved++
        calls.savedOptions.push(options)
        return account
      },
      update: async (_id: string, patch: { teamId?: string }) => {
        account = { ...account, ...patch }
        return account
      }
    }
  } as unknown as AppleAccounts

  return { apple, calls, account: () => account, certificates }
}

// --- catalog ------------------------------------------------------------------------------------------------

export const ipaFile = (name: string): FileSource =>
  bytesFileSource(name, new Uint8Array([0x50, 0x4b]))

export const fakeCatalog = () => {
  const calls = { downloads: 0, resolved: [] as string[] }
  const catalog = {
    manifest: async () => ({ version: 1, apps: [] }),
    recommendedChannel: async () => 'stable' as const,
    resolve: async (
      appId: string,
      channel: 'stable' | 'nightly'
    ): Promise<ResolvedRelease> => {
      calls.resolved.push(`${appId}:${channel}`)
      return {
        appId,
        channel,
        version: '1.0',
        url: 'https://example.com/a.ipa',
        fileName: `${appId}.ipa`,
        sha256: SHA256,
        from: 'primary'
      }
    },
    download: async (release: ResolvedRelease) => {
      calls.downloads++
      return {
        file: ipaFile(release.fileName),
        sha256: release.sha256,
        cached: false
      }
    }
  } as unknown as Catalog

  return { catalog, calls }
}

// --- signer -------------------------------------------------------------------------------------------------

const MAIN_IDS: Readonly<Record<string, string>> = {
  'sidestore.ipa': 'com.SideStore.SideStore',
  'livecontainer-sidestore.ipa': 'com.kdt.livecontainer'
}

export const inspectionFor = (
  identifier: string,
  name = 'App'
): IpaInspection => ({
  app: {
    path: `Payload/${name}.app`,
    identifier,
    name,
    deviceFamilies: [1],
    architectures: ['arm64']
  },
  nested: [],
  appGroups: [],
  keychainAccessGroups: [],
  altAppGroups: []
})

const bundle = (
  path: string,
  identifier: string,
  kind: CodeBundle['kind']
): CodeBundle => ({
  path,
  kind,
  identifier,
  infoPlist: createDict(),
  executable: `${path}/Exec`,
  depth: path === '' ? 0 : 1
})

/** The bundles an IPA with main app `identifier` holds (LiveContainer carries the SideStore framework). */
export const bundlesFor = (identifier: string): CodeBundle[] =>
  identifier === 'com.kdt.livecontainer'
    ? [
        bundle(
          'Frameworks/SideStoreApp.framework',
          'com.SideStore.SideStore',
          'framework'
        ),
        bundle('', identifier, 'app')
      ]
    : [bundle('', identifier, 'app')]

export const fakeSigner = (
  identifiers: Readonly<Record<string, string>> = {}
) => {
  const idOf = (file: FileSource) =>
    identifiers[file.name] ?? MAIN_IDS[file.name] ?? 'com.example.app'
  const calls = { inspected: 0, bundles: 0, signed: [] as SignRequest[] }
  const signer: IpaSigner = {
    inspect: async (file) => {
      calls.inspected++
      return inspectionFor(idOf(file))
    },
    bundles: async (file) => {
      calls.bundles++
      return bundlesFor(idOf(file))
    },
    sign: async (file, request) => {
      calls.signed.push(request)
      request.onProgress?.(1)
      return bytesFileSource(file.name, new Uint8Array([1, 2, 3])).stream()
    }
  }

  return { signer, calls, idOf }
}
