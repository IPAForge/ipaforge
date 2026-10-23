// Test-only: a scriptable iPhone behind a fake usbmuxd (usbmux, lockdownd and the services IPAForge uses).

import * as pkijs from 'pkijs'

import {
  createFakeFs,
  type FakeFs,
  serveAfc
} from '@device/__tests__/fake-device/fake-afc.ts'
import { createPipe } from '@device/__tests__/fake-device/pipe.ts'
import {
  type FakeTunnel,
  type FakeTunnelOptions,
  serveFakeTunnel
} from '@device/__tests__/fake-tunnel/fake-tunnel.ts'
import { lockdownAdvert } from '@device/__tests__/mdns-answer.ts'
import { DEFAULT_DEVICE_CONFIG } from '@device/domain/config.ts'
import {
  CORE_DEVICE_PROXY_SERVICE,
  LOCKDOWN_PORT,
  Service,
  UsbmuxResult
} from '@device/domain/constants.ts'
import { parseVersion } from '@device/domain/device.ts'
import { serializePairRecord } from '@device/domain/pairing/pair-record.ts'
import { encodePem } from '@device/domain/pairing/pem.ts'
import { supportsRemotePairing } from '@device/domain/pairing-apps.ts'
import type {
  Datagram,
  DeviceTransport,
  TlsCredentials
} from '@device/domain/ports/types.ts'
import { summarizeProfile } from '@device/domain/profiles.ts'
import { createLink, type Link } from '@device/infrastructure/framing/link.ts'
import {
  type FrameLimits,
  receivePlist,
  sendPlist
} from '@device/infrastructure/framing/plist-frames.ts'
import { createPairRecord } from '@device/infrastructure/pairing/certificates.ts'
import {
  encodeUsbmuxPacket,
  readUsbmuxPacket,
  toNetworkPort
} from '@device/infrastructure/usbmux/protocol.ts'
import {
  createDict,
  ErrorCode,
  IPAForgeError,
  isPlistDict,
  type PlistDict,
  type PlistValue,
  type SecretStore,
  utf8Decode,
  utf8Encode
} from '@ipaforge/kernel'

const LIMITS: FrameLimits = {
  maxMessageBytes: DEFAULT_DEVICE_CONFIG.maxMessageBytes,
  plist: DEFAULT_DEVICE_CONFIG.plist
}

export type FakeApp = {
  readonly bundleId: string
  readonly name: string
  readonly version: string
  readonly container: FakeFs
}

export type FakeDeviceOptions = {
  readonly udid?: string
  readonly deviceId?: number
  readonly productVersion?: string
  readonly connectionType?: 'USB' | 'Network'
  /** Pair answers PairingDialogResponsePending this many times before accepting. */
  readonly pendingPolls?: number
  /** Pair answers PasswordProtected this many times first. */
  readonly lockedPolls?: number
  readonly denyPairing?: boolean
  /** `undefined` = the device does not report it (before iOS 16). */
  readonly developerMode?: boolean | undefined
  /** The screen is locked (lockdownd `PasswordProtected`). */
  readonly locked?: boolean
  /** A passcode is set (Wi-Fi debugging needs one). */
  readonly hasPasscode?: boolean
  /** CoreDeviceProxy opens the iOS 17.4+ tunnel. Default: from iOS 17.4. */
  readonly tunnel?: boolean
}

/** What the host's TLS adapter throws when the handshake fails (`tlsHandshakeFails`). */
const tlsHandshakeFailure = (): IPAForgeError =>
  new IPAForgeError(ErrorCode.DeviceProtocolError, {
    message: 'TLS handshake with the device failed: fake'
  })

export type FakeDevice = {
  readonly udid: string
  readonly deviceId: number
  readonly connectionType: 'USB' | 'Network'
  readonly productVersion: string
  readonly media: FakeFs
  readonly apps: Map<string, FakeApp>
  readonly profiles: Uint8Array[]
  readonly values: Map<string, PlistValue>
  readonly acceptedHostIds: Set<string>
  readonly requests: string[]
  readonly tlsUpgrades: TlsCredentials[]
  pendingPolls: number
  lockedPolls: number
  denyPairing: boolean
  developerMode: boolean | undefined
  locked: boolean
  hasPasscode: boolean
  /** Every TLS upgrade fails, as a dropped handshake does. */
  tlsHandshakeFails: boolean
  /** The next install fails with this installation_proxy error. */
  nextInstallError: string | undefined
  nextInstallDescription: string | undefined
  /** The next install gets no answer at all, as from a device that locked mid-install. */
  installGoesSilent: boolean
  devicePublicKeyPem: Uint8Array
  /** CoreDeviceProxy is there (iOS 17.4 and later). */
  tunnel: boolean
  /** Services lockdown's StartService refuses (`InvalidService`), though their shims in the tunnel work. */
  readonly refusedServices: Set<string>
  /** Every tunnel opened, in order. */
  readonly tunnels: FakeTunnel[]
  /** How the next tunnels behave (TCP peer, refused check-ins…). */
  tunnelOptions: Partial<FakeTunnelOptions>
}

export type FakeUsbmuxdOptions = {
  /** The OS pairs (the user taps Trust) after this many `ReadPairRecord` misses; `undefined` = it never does. */
  readonly osPairsAfterMisses?: number
}

export type FakeUsbmuxd = {
  readonly transport: DeviceTransport
  readonly devices: FakeDevice[]
  readonly pairRecords: Map<string, Uint8Array>
  readonly buid: string
  /** Every usbmuxd `MessageType` received, in order. */
  readonly requests: string[]
  /** See `FakeUsbmuxdOptions`. */
  osPairsAfterMisses: number | undefined
  /** usbmuxd is not running: every connection fails. */
  unavailable: boolean
  /** Devices on the fake Wi-Fi, by address: they answer mDNS queries and take TCP connections. */
  readonly onWifi: Map<string, FakeDevice>
  /** Extra TXT entries a device's Wi-Fi advert carries (identifier, authTag), by UDID. */
  readonly wifiTxt: Map<string, readonly string[]>
  /** The OS refuses local network access (macOS): every mDNS send fails. */
  localNetworkDenied: boolean
  attach(device: FakeDevice): void
  detach(udid: string): void
}

/** A real RSA key, as lockdownd reports `DevicePublicKey` (PKCS#1 PEM). */
const devicePublicKey = async (): Promise<Uint8Array> => {
  const keys = await crypto.subtle.generateKey(
    {
      name: 'RSASSA-PKCS1-v1_5',
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: 'SHA-256'
    },
    true,
    ['sign', 'verify']
  )
  const spki = pkijs.PublicKeyInfo.fromBER(
    await crypto.subtle.exportKey('spki', keys.publicKey)
  )

  return utf8Encode(
    encodePem(
      'RSA PUBLIC KEY',
      new Uint8Array(spki.subjectPublicKey.valueBlock.valueHexView)
    )
  )
}

let sharedKey: Promise<Uint8Array> | undefined
const sharedDevicePublicKey = (): Promise<Uint8Array> => {
  if (!sharedKey) sharedKey = devicePublicKey()
  return sharedKey
}

export const createFakeDevice = async (
  options: FakeDeviceOptions = {}
): Promise<FakeDevice> => ({
  udid: options.udid ?? '00008110-001A2B3C4D5E6F70',
  deviceId: options.deviceId ?? 7,
  connectionType: options.connectionType ?? 'USB',
  productVersion: options.productVersion ?? '18.2',
  media: createFakeFs(),
  apps: new Map(),
  profiles: [],
  values: new Map(),
  acceptedHostIds: new Set(),
  requests: [],
  tlsUpgrades: [],
  pendingPolls: options.pendingPolls ?? 0,
  lockedPolls: options.lockedPolls ?? 0,
  denyPairing: options.denyPairing ?? false,
  developerMode: 'developerMode' in options ? options.developerMode : true,
  locked: options.locked ?? false,
  hasPasscode: options.hasPasscode ?? true,
  tlsHandshakeFails: false,
  nextInstallError: undefined,
  nextInstallDescription: undefined,
  installGoesSilent: false,
  devicePublicKeyPem: await sharedDevicePublicKey(),
  // CoreDeviceProxy came with remote pairing, in iOS 17.4.
  tunnel:
    options.tunnel ??
    supportsRemotePairing(parseVersion(options.productVersion ?? '18.2')),
  refusedServices: new Set(),
  tunnels: [],
  tunnelOptions: {}
})

export const addApp = (
  device: FakeDevice,
  bundleId: string,
  name = bundleId
): FakeApp => {
  const app: FakeApp = {
    bundleId,
    name,
    version: '1',
    container: createFakeFs()
  }
  app.container.dirs.add('Documents')
  device.apps.set(bundleId, app)
  return app
}

/** A fake signed profile: junk bytes around an XML plist, like a CMS-wrapped `.mobileprovision`. */
export const fakeProfile = (fields: {
  uuid: string
  name: string
  teamId: string
  bundleId: string
  expires: Date
}) => {
  const body = `<?xml version="1.0" encoding="UTF-8"?><plist version="1.0"><dict>
<key>UUID</key><string>${fields.uuid}</string><key>Name</key><string>${fields.name}</string>
<key>TeamIdentifier</key><array><string>${fields.teamId}</string></array>
<key>ExpirationDate</key><date>${fields.expires.toISOString().replace(/\.\d+Z$/, 'Z')}</date>
<key>Entitlements</key><dict><key>application-identifier</key><string>${fields.teamId}.${fields.bundleId}</string></dict>
</dict></plist>`

  return new Uint8Array([0x30, 0x82, 0x01, ...utf8Encode(body), 0xa0, 0x00])
}

const deviceValues = (device: FakeDevice): PlistDict =>
  createDict([
    ['UniqueDeviceID', device.udid],
    ['DeviceName', 'Test iPhone'],
    ['ProductType', 'iPhone17,1'],
    ['ProductVersion', device.productVersion],
    ['BuildVersion', '22C152'],
    ['DeviceClass', 'iPhone'],
    ['CPUArchitecture', 'arm64e'],
    ['ActivationState', 'Activated'],
    ['PasswordProtected', device.locked]
  ])

type Fields = readonly (readonly [string, PlistValue])[]

/** The next plist message, or `undefined` once the client has closed the link. */
const nextPlist = (link: Link): Promise<PlistDict | undefined> =>
  receivePlist(link, LIMITS).catch(() => undefined)

const stringOf = (value: PlistValue | undefined): string | undefined =>
  typeof value === 'string' ? value : undefined

const AMFI_DOMAIN = 'com.apple.security.mac.amfi'
const FIRST_SERVICE_PORT = 49_152

/** One lockdownd request and what a handler can do with it. */
type LockdownRequest = {
  readonly message: PlistDict
  readonly device: FakeDevice
  readonly answer: (fields: Fields) => Promise<void>
  readonly fail: (error: string) => Promise<void>
  /** Starts listening for `service` and returns its port. */
  readonly openPort: (service: string) => number
}

type LockdownHandler = (request: LockdownRequest) => Promise<void>

/** What lockdownd reports for `domain`/`key`; `undefined` when it has no value. */
/** Every fake device's Wi-Fi MAC address, as lockdown reports it and its Wi-Fi advert's name starts. */
export const WIFI_MAC = 'aa:bb:cc:dd:ee:ff'

const lockdownValue = (
  device: FakeDevice,
  domain: string | undefined,
  key: string | undefined
): PlistValue | undefined => {
  if (key === 'DevicePublicKey') return device.devicePublicKeyPem
  if (key === 'WiFiAddress') return WIFI_MAC
  if (domain === AMFI_DOMAIN && key === 'DeveloperModeStatus')
    return device.developerMode
  if (!key) return deviceValues(device)
  return (
    device.values.get(`${domain ?? ''}/${key}`) ?? deviceValues(device)[key]
  )
}

const getValue: LockdownHandler = async ({ message, device, answer, fail }) => {
  const value = lockdownValue(
    device,
    stringOf(message.Domain),
    stringOf(message.Key)
  )
  if (value === undefined) await fail('MissingValue')
  else await answer([['Value', value]])
}

const setValue: LockdownHandler = async ({ message, device, answer, fail }) => {
  if (message.Key === 'EnableWifiDebugging' && !device.hasPasscode)
    return fail('MissingValue')
  device.values.set(
    `${String(message.Domain)}/${String(message.Key)}`,
    message.Value ?? ''
  )
  await answer([])
}

/** Why the device refuses to pair right now (counting down the scripted polls), or `undefined`. */
const pairRefusal = (device: FakeDevice): string | undefined => {
  if (device.lockedPolls > 0) {
    device.lockedPolls--
    return 'PasswordProtected'
  }
  if (device.denyPairing) return 'UserDeniedPairing'
  if (device.pendingPolls > 0) {
    device.pendingPolls--
    return 'PairingDialogResponsePending'
  }
  return undefined
}

const pair: LockdownHandler = async ({ message, device, answer, fail }) => {
  const record = isPlistDict(message.PairRecord)
    ? message.PairRecord
    : createDict()
  const refusal = pairRefusal(device)
  if (refusal) return fail(refusal)
  device.acceptedHostIds.add(String(record.HostID))
  await answer([['EscrowBag', utf8Encode('escrow')]])
}

const startSession: LockdownHandler = async ({
  message,
  device,
  answer,
  fail
}) => {
  if (!device.acceptedHostIds.has(String(message.HostID)))
    return fail('InvalidHostID')
  await answer([
    ['SessionID', 'SESSION-1'],
    ['EnableSessionSSL', true]
  ])
}

const isService = (service: string, device: FakeDevice): boolean =>
  service === CORE_DEVICE_PROXY_SERVICE
    ? device.tunnel
    : Object.values(Service).includes(service as never) &&
      !device.refusedServices.has(service)

const startService: LockdownHandler = async ({
  message,
  device,
  answer,
  fail,
  openPort
}) => {
  const service = String(message.Service)
  if (!isService(service, device)) return fail('InvalidService')
  await answer([
    ['Port', openPort(service)],
    ['Service', service],
    ['EnableServiceSSL', service !== Service.Afc]
  ])
}

const LOCKDOWN_HANDLERS: ReadonlyMap<string, LockdownHandler> = new Map([
  [
    'QueryType',
    ({ answer }) => answer([['Type', 'com.apple.mobile.lockdown']])
  ],
  ['GetValue', getValue],
  ['SetValue', setValue],
  ['Pair', pair],
  ['StartSession', startSession],
  ['StartService', startService],
  ['StopSession', ({ answer }) => answer([])]
])

const unknownRequest: LockdownHandler = ({ fail }) => fail('UnknownRequest')

const serveLockdown = async (
  link: Link,
  device: FakeDevice,
  ports: Map<number, string>
): Promise<void> => {
  let nextPort = FIRST_SERVICE_PORT + ports.size
  const openPort = (service: string): number => {
    const port = nextPort++
    ports.set(port, service)
    return port
  }
  for (
    let message = await nextPlist(link);
    message;
    message = await nextPlist(link)
  ) {
    const request = String(message.Request)
    device.requests.push(`lockdown:${request}`)
    const answer = (fields: Fields) =>
      sendPlist(link, createDict([['Request', request], ...fields]))
    const handler = LOCKDOWN_HANDLERS.get(request) ?? unknownRequest
    await handler({
      message,
      device,
      answer,
      fail: (error) => answer([['Error', error]]),
      openPort
    })
  }
}

/** One installation_proxy command and a way to send its replies. */
type ProxyCommand = {
  readonly message: PlistDict
  readonly device: FakeDevice
  readonly send: (fields: Fields) => Promise<void>
}

type ProxyHandler = (command: ProxyCommand) => Promise<void>

const INSTALL_PROGRESS = [
  ['CreatingStagingDirectory', 5],
  ['VerifyingApplication', 40],
  ['InstallingApplication', 80]
] as const

/** The scripted install failure, consumed: it applies to the next install only. */
const takeInstallError = (device: FakeDevice): Fields | undefined => {
  const error = device.nextInstallError
  if (!error) return undefined
  const description = device.nextInstallDescription ?? `fake: ${error}`
  device.nextInstallError = undefined
  device.nextInstallDescription = undefined
  return [
    ['Error', error],
    ['ErrorDescription', description]
  ]
}

const install: ProxyHandler = async ({ message, device, send }) => {
  const ipa = device.media.files.get(String(message.PackagePath))
  const failure = takeInstallError(device)
  if (failure) return send(failure)
  if (device.installGoesSilent) {
    device.installGoesSilent = false
    return
  }
  if (!ipa) return send([['Error', 'PackageNotFound']])
  // Fake IPAs are the text "IPA:<bundle id>".
  const bundleId = utf8Decode(ipa).replace(/^IPA:/, '')
  for (const [status, percent] of INSTALL_PROGRESS) {
    await send([
      ['Status', status],
      ['PercentComplete', percent]
    ])
  }
  addApp(device, bundleId)
  await send([['Status', 'Complete']])
}

const uninstall: ProxyHandler = async ({ message, device, send }) => {
  device.apps.delete(String(message.ApplicationIdentifier))
  await send([['Status', 'Complete']])
}

const browse: ProxyHandler = async ({ device, send }) => {
  const list = [...device.apps.values()].map((app) =>
    createDict([
      ['CFBundleIdentifier', app.bundleId],
      ['CFBundleName', app.name],
      ['CFBundleVersion', app.version]
    ])
  )
  await send([
    ['Status', 'BrowsingApplications'],
    ['CurrentList', list],
    ['Total', list.length]
  ])
  await send([['Status', 'Complete']])
}

const lookupIds = (message: PlistDict): string[] => {
  const options = isPlistDict(message.ClientOptions)
    ? message.ClientOptions
    : createDict()

  return Array.isArray(options.BundleIDs) ? options.BundleIDs.map(String) : []
}

const lookup: ProxyHandler = async ({ message, device, send }) => {
  const result = createDict(
    lookupIds(message)
      .filter((id) => device.apps.has(id))
      .map((id) => [id, createDict([['CFBundleIdentifier', id]])] as const)
  )
  await send([
    ['LookupResult', result],
    ['Status', 'Complete']
  ])
}

const PROXY_HANDLERS: ReadonlyMap<string, ProxyHandler> = new Map([
  ['Install', install],
  ['Upgrade', install],
  ['Uninstall', uninstall],
  ['Browse', browse],
  ['Lookup', lookup]
])

const unknownCommand: ProxyHandler = ({ send }) =>
  send([['Error', 'UnknownCommand']])

const serveInstallationProxy = async (
  link: Link,
  device: FakeDevice
): Promise<void> => {
  const send = (fields: Fields) => sendPlist(link, createDict(fields))
  for (
    let message = await nextPlist(link);
    message;
    message = await nextPlist(link)
  ) {
    const command = String(message.Command)
    device.requests.push(`installation_proxy:${command}`)
    const handler = PROXY_HANDLERS.get(command) ?? unknownCommand
    await handler({ message, device, send })
  }
}

const PROFILE_NOT_FOUND = 0xe8008015

/** misagent's reply to `message`. */
const misagentReply = (device: FakeDevice, message: PlistDict): Fields => {
  const type = String(message.MessageType)
  if (type === 'CopyAll')
    return [
      ['Payload', [...device.profiles]],
      ['Status', 0]
    ]
  if (type === 'Install' && message.Profile instanceof Uint8Array) {
    device.profiles.push(message.Profile)
    return [['Status', 0]]
  }
  if (type === 'Remove') {
    const index = device.profiles.findIndex(
      (raw) => summarizeProfile(raw)?.uuid === message.ProfileID
    )
    if (index < 0) return [['Status', PROFILE_NOT_FOUND]]
    device.profiles.splice(index, 1)
    return [['Status', 0]]
  }
  return [['Status', 1]]
}

const serveMisagent = async (link: Link, device: FakeDevice): Promise<void> => {
  for (
    let message = await nextPlist(link);
    message;
    message = await nextPlist(link)
  ) {
    device.requests.push(`misagent:${String(message.MessageType)}`)
    await sendPlist(link, createDict(misagentReply(device, message)))
  }
}

const serveHouseArrest = async (
  link: Link,
  device: FakeDevice
): Promise<void> => {
  const message = await nextPlist(link)
  if (!message) return
  device.requests.push(`house_arrest:${String(message.Command)}`)
  const app = device.apps.get(String(message.Identifier))
  if (!app) {
    await sendPlist(link, createDict([['Error', 'ApplicationLookupFailed']]))
    return
  }
  await sendPlist(link, createDict([['Status', 'Complete']]))
  await serveAfc(link, app.container)
}

const serveAmfi = async (link: Link, device: FakeDevice): Promise<void> => {
  const message = await nextPlist(link)
  if (!message) return
  device.requests.push(`amfi:${String(message.action)}`)
  await sendPlist(link, createDict([['success', true]]))
}

/** CoreDeviceProxy: the tunnel, with a shim for every service above. */
const serveTunnel = async (link: Link, device: FakeDevice): Promise<void> => {
  const shims = new Map(
    Object.values(Service).map((service) => [
      service,
      (shimLink: Link) => serveService(service, shimLink, device)
    ])
  )
  device.requests.push('tunnel:open')
  const tunnel = serveFakeTunnel(link, {
    shims,
    xpcServices: ['com.apple.coredevice.appservice'],
    properties: {
      UniqueDeviceID: device.udid,
      ProductVersion: device.productVersion
    },
    ...device.tunnelOptions
  })
  device.tunnels.push(tunnel)
  await tunnel.closed
}

const serveService = (
  service: string,
  link: Link,
  device: FakeDevice
): Promise<void> => {
  switch (service) {
    case CORE_DEVICE_PROXY_SERVICE:
      return serveTunnel(link, device)
    case Service.Afc:
      return serveAfc(link, device.media)
    case Service.InstallationProxy:
      return serveInstallationProxy(link, device)
    case Service.Misagent:
      return serveMisagent(link, device)
    case Service.HouseArrest:
      return serveHouseArrest(link, device)
    case Service.Amfi:
      return serveAmfi(link, device)
    default:
      return Promise.resolve()
  }
}

type OnTls = (handler: (credentials: TlsCredentials) => void) => void

type ConnectTarget = { readonly device: FakeDevice; readonly service: string }

/** How usbmuxd answers one tagged request. */
type UsbmuxReply = {
  readonly reply: (fields: Fields) => Promise<void>
  readonly result: (number: number) => Promise<void>
}

const usbmuxReply = (link: Link, tag: number): UsbmuxReply => {
  const reply = (fields: Fields) =>
    link.write(encodeUsbmuxPacket(tag, createDict(fields)))

  return {
    reply,
    result: (number) =>
      reply([
        ['MessageType', 'Result'],
        ['Number', number]
      ])
  }
}

/** The next usbmuxd request, or `undefined` once the client has closed the link. */
const nextUsbmuxPacket = (link: Link) =>
  readUsbmuxPacket(link, LIMITS).catch(() => undefined)

const deviceListEntry = (device: FakeDevice): PlistDict =>
  createDict([
    ['DeviceID', device.deviceId],
    ['MessageType', 'Attached'],
    [
      'Properties',
      createDict([
        ['ConnectionType', device.connectionType],
        ['DeviceID', device.deviceId],
        ['SerialNumber', device.udid]
      ])
    ]
  ])

export const createFakeUsbmuxd = (
  devices: FakeDevice[] = [],
  options: FakeUsbmuxdOptions = {}
): FakeUsbmuxd => {
  const listeners = new Set<(packet: Uint8Array) => void>()
  const pairRecordMisses = new Map<string, number>()
  const ports = new Map<FakeDevice, Map<number, string>>()
  const portsOf = (device: FakeDevice) => {
    let map = ports.get(device)
    if (!map) {
      map = new Map()
      ports.set(device, map)
    }
    return map
  }

  const attachedPacket = (device: FakeDevice) =>
    encodeUsbmuxPacket(
      0,
      createDict([
        ['MessageType', 'Attached'],
        ['DeviceID', device.deviceId],
        [
          'Properties',
          createDict([
            ['ConnectionType', device.connectionType],
            ['DeviceID', device.deviceId],
            ['SerialNumber', device.udid],
            ['ProductID', 4776]
          ])
        ]
      ])
    )

  const fake: FakeUsbmuxd = {
    devices,
    pairRecords: new Map(),
    buid: '11111111-2222-3333-4444-555555555555',
    requests: [],
    osPairsAfterMisses: options.osPairsAfterMisses,
    unavailable: false,
    onWifi: new Map(),
    wifiTxt: new Map(),
    localNetworkDenied: false,
    attach: (device) => {
      devices.push(device)
      for (const listener of listeners) listener(attachedPacket(device))
    },
    detach: (udid) => {
      const index = devices.findIndex((device) => device.udid === udid)
      const [device] = index >= 0 ? devices.splice(index, 1) : []
      if (!device) return
      const packet = encodeUsbmuxPacket(
        0,
        createDict([
          ['MessageType', 'Detached'],
          ['DeviceID', device.deviceId]
        ])
      )
      for (const listener of listeners) listener(packet)
    },
    transport: {
      connectUsbmux: async () => {
        if (fake.unavailable) throw new Error('ENOENT: /var/run/usbmuxd')
        const pipe = createPipe()
        void serve(createLink(pipe.server), pipe.onTls)
        return pipe.client
      },
      connectTcp: async (host, port) => {
        const device = fake.onWifi.get(host)
        const service =
          port === LOCKDOWN_PORT
            ? 'lockdown'
            : device && portsOf(device).get(port)
        if (!device || !service)
          throw new IPAForgeError(ErrorCode.DeviceDisconnected, {
            data: { host, port }
          })
        fake.requests.push(`tcp:${host}:${port}`)
        const pipe = createPipe()
        void handOver(createLink(pipe.server), pipe.onTls, { device, service })
        return pipe.client
      },
      openMulticast: async () => {
        const listeners = new Set<(datagram: Datagram) => void>()

        return {
          send: async () => {
            if (fake.localNetworkDenied)
              throw new IPAForgeError(ErrorCode.LocalNetworkDenied)
            for (const [address, device] of fake.onWifi) {
              const bytes = lockdownAdvert({
                mac: WIFI_MAC,
                host: `${device.udid.slice(-4)}.local`,
                address,
                txt: fake.wifiTxt.get(device.udid) ?? []
              })
              for (const listener of [...listeners])
                listener({ bytes, from: address })
            }
          },
          onMessage: (listener) => {
            listeners.add(listener)
            return () => listeners.delete(listener)
          },
          close: async () => listeners.clear()
        }
      }
    }
  }

  /** What the OS does when the user taps Trust: it pairs with its own certificates and keeps the record. */
  const osPair = async (udid: string): Promise<Uint8Array | undefined> => {
    const device = devices.find((candidate) => candidate.udid === udid)
    if (!device) return undefined
    const record = await createPairRecord({
      devicePublicKey: device.devicePublicKeyPem,
      systemBuid: fake.buid,
      now: new Date()
    })
    device.acceptedHostIds.add(record.hostId)
    const bytes = serializePairRecord({ ...record, udid })
    fake.pairRecords.set(udid, bytes)
    return bytes
  }

  /** The stored record; otherwise counts a miss, and the OS pairs once `osPairsAfterMisses` have passed. */
  const readPairRecord = async (
    udid: string
  ): Promise<Uint8Array | undefined> => {
    const stored = fake.pairRecords.get(udid)
    if (stored) return stored
    const misses = pairRecordMisses.get(udid) ?? 0
    if (
      fake.osPairsAfterMisses === undefined ||
      misses < fake.osPairsAfterMisses
    ) {
      pairRecordMisses.set(udid, misses + 1)
      return undefined
    }
    pairRecordMisses.delete(udid)
    return osPair(udid)
  }

  /** Where a `Connect` lands: the device and its service, or the usbmuxd result refusing it. */
  const connectTarget = (message: PlistDict): ConnectTarget | number => {
    const device = devices.find(
      (candidate) => candidate.deviceId === message.DeviceID
    )
    if (!device) return UsbmuxResult.BadDevice
    const port = toNetworkPort(Number(message.PortNumber))
    const service =
      port === LOCKDOWN_PORT ? 'lockdown' : portsOf(device).get(port)

    return service ? { device, service } : UsbmuxResult.ConnectionRefused
  }

  /** From here on the connection belongs to the device's lockdownd or service. */
  const handOver = async (
    link: Link,
    onTls: OnTls,
    { device, service }: ConnectTarget
  ): Promise<void> => {
    onTls((credentials) => {
      if (device.tlsHandshakeFails) throw tlsHandshakeFailure()
      device.tlsUpgrades.push(credentials)
    })
    if (service === 'lockdown')
      await serveLockdown(link, device, portsOf(device))
    else await serveService(service, link, device)
  }

  const listen = async (link: Link, result: UsbmuxReply['result']) => {
    await result(UsbmuxResult.Ok)
    for (const device of devices) await link.write(attachedPacket(device))
    listeners.add((bytes) => void link.write(bytes))
  }

  const sendPairRecord = async (
    message: PlistDict,
    { reply, result }: UsbmuxReply
  ) => {
    const record = await readPairRecord(String(message.PairRecordID))
    if (record) await reply([['PairRecordData', record]])
    else await result(UsbmuxResult.BadDevice)
  }

  /** usbmuxd's answer to every request except `Connect`. */
  const respond = (
    link: Link,
    message: PlistDict,
    answer: UsbmuxReply
  ): Promise<void> => {
    switch (message.MessageType) {
      case 'ListDevices':
        return answer.reply([['DeviceList', devices.map(deviceListEntry)]])
      case 'Listen':
        return listen(link, answer.result)
      case 'ReadBUID':
        return answer.reply([['BUID', fake.buid]])
      case 'ReadPairRecord':
        return sendPairRecord(message, answer)
      default:
        return answer.result(UsbmuxResult.BadCommand)
    }
  }

  const serve = async (link: Link, onTls: OnTls): Promise<void> => {
    for (
      let packet = await nextUsbmuxPacket(link);
      packet;
      packet = await nextUsbmuxPacket(link)
    ) {
      const { message } = packet
      const answer = usbmuxReply(link, packet.tag)
      fake.requests.push(String(message.MessageType))
      if (message.MessageType !== 'Connect') {
        await respond(link, message, answer)
        continue
      }
      const target = connectTarget(message)
      if (typeof target === 'number') {
        await answer.result(target)
        continue
      }
      await answer.result(UsbmuxResult.Ok)
      await handOver(link, onTls, target)
      return
    }
  }

  return fake
}

/** An in-memory SecretStore. */
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
