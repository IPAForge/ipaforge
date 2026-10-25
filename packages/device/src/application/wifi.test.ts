// Wi-Fi without usbmuxd: what a session sets up, and finding and opening a known device on the network.
import { describe, expect, it } from 'vitest'

import { WIFI_MAC } from '@device/__tests__/fake-device/fake-device.ts'
import { createRig, type TestRig } from '@device/__tests__/setup.ts'
import { createDeviceManager } from '@device/application/manager.ts'
import {
  LockdownDomain,
  WIFI_CONNECTIONS_KEY
} from '@device/domain/constants.ts'
import { parsePairRecord } from '@device/domain/pairing/pair-record.ts'
import {
  remotePairingSecretKey,
  serializeRemotePairing
} from '@device/domain/remote-pairing/record.ts'
import type { DeviceEvent } from '@device/domain/types.ts'
import {
  parseKnownDevices,
  serializeKnownDevices,
  WIFI_DEVICES_KEY
} from '@device/domain/wifi.ts'
import {
  DEFAULT_PLIST_LIMITS,
  ErrorCode,
  type Logger,
  toBase64,
  utf8Encode
} from '@ipaforge/kernel'

const codeOf = async (promise: Promise<unknown>) => {
  try {
    await promise
  } catch (error) {
    return (error as { code?: string }).code
  }
  return undefined
}

const WIFI_KEY = `${LockdownDomain.WirelessLockdown}/${WIFI_CONNECTIONS_KEY}`
const ADDRESS = '192.0.2.10'

const openAndClose = async (rig: TestRig) => {
  const handle = await rig.manager.open(rig.device.udid)
  await handle.close()
}

/** The device leaves the cable and usbmuxd, and is on the fake Wi-Fi instead. */
const moveToWifi = (rig: TestRig) => {
  rig.fake.detach(rig.device.udid)
  rig.fake.onWifi.set(ADDRESS, rig.device)
}

/** The authTag a device sends for `hostId` (the same scheme as the code under test; the vector test pins it). */
const bytes = (text: string): Uint8Array<ArrayBuffer> =>
  new Uint8Array(utf8Encode(text))

const authTagFor = async (hostId: string, identifier: string) => {
  const subtle = globalThis.crypto.subtle
  const ikm = await subtle.importKey('raw', bytes(hostId), 'HKDF', false, [
    'deriveBits'
  ])
  const bits = await subtle.deriveBits(
    {
      name: 'HKDF',
      hash: 'SHA-512',
      salt: new Uint8Array(0),
      info: new Uint8Array(0)
    },
    ikm,
    256
  )
  const key = await subtle.importKey(
    'raw',
    bits,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const tag = new Uint8Array(await subtle.sign('HMAC', key, bytes(identifier)))

  return toBase64(tag.subarray(0, 8))
}

const watchUntil = async (rig: TestRig, count: number) => {
  const events: DeviceEvent[] = []
  const controller = new AbortController()
  await rig.manager.watchNetwork((event) => {
    events.push(event)
    if (events.length >= count) controller.abort()
  }, controller.signal)
  return events
}

describe('Wi-Fi without usbmuxd', () => {
  it("turns on the device's Wi-Fi connections when a session opens, and remembers the device", async () => {
    const rig = await createRig()
    await openAndClose(rig)

    expect(rig.device.values.get(WIFI_KEY)).toBe(true)
    expect(parseKnownDevices(await rig.secrets.get(WIFI_DEVICES_KEY))).toEqual([
      { udid: rig.device.udid, mac: WIFI_MAC }
    ])
  })

  it('leaves Wi-Fi connections alone when they are on already, or when the host says not to', async () => {
    const on = await createRig()
    on.device.values.set(WIFI_KEY, true)
    await openAndClose(on)
    expect(on.device.requests).not.toContain('lockdown:SetValue')

    const off = await createRig({}, { enableWifiConnections: false })
    await openAndClose(off)
    expect(off.device.values.has(WIFI_KEY)).toBe(false)
  })

  it('finds a known device on Wi-Fi and opens it straight at its address', async () => {
    const rig = await createRig()
    await openAndClose(rig)
    moveToWifi(rig)

    const handle = await rig.manager.open(rig.device.udid)
    expect(handle.device).toMatchObject({
      udid: rig.device.udid,
      connectionType: 'network',
      address: ADDRESS
    })
    expect(rig.fake.requests).toContain(`tcp:${ADDRESS}:62078`)
    await handle.close()
  })

  it("matches a device by its authTag when its advert's MAC is a private one", async () => {
    const rig = await createRig()
    await rig.secrets.set(
      WIFI_DEVICES_KEY,
      serializeKnownDevices([
        { udid: rig.device.udid, mac: '02:00:00:00:00:99' }
      ])
    )
    const record = parsePairRecord(
      await rig.manager.exportPairRecord(rig.device.udid),
      DEFAULT_PLIST_LIMITS
    )
    const identifier = '0A1B2C3D-4E5F-4A6B-8C7D-9E0F1A2B3C4D'
    // One tag per paired computer, the second and later under `authTag#1`, `authTag#2`…: this one's is the second.
    rig.fake.wifiTxt.set(rig.device.udid, [
      `identifier=${identifier}`,
      `authTag=${await authTagFor('another computer', identifier)}`,
      `authTag#1=${await authTagFor(record.hostId, identifier)}`
    ])
    moveToWifi(rig)

    const [event] = await watchUntil(rig, 1)
    expect(event).toMatchObject({
      kind: 'attached',
      device: { udid: rig.device.udid, address: ADDRESS }
    })
  })

  it('ignores a device on the network that this computer does not know', async () => {
    const rig = await createRig()
    moveToWifi(rig)
    expect(await rig.manager.discoverNetwork()).toEqual([])
  })

  it('lists Wi-Fi devices while a search runs, also without usbmuxd', async () => {
    const rig = await createRig()
    await openAndClose(rig)
    moveToWifi(rig)
    rig.fake.unavailable = true
    const controller = new AbortController()
    let listed: unknown
    await rig.manager.watchNetwork(async () => {
      listed = await rig.manager.listDevices()
      controller.abort()
    }, controller.signal)

    expect(listed).toEqual([
      expect.objectContaining({ udid: rig.device.udid, address: ADDRESS })
    ])
  })

  it('says when the OS refuses local network access', async () => {
    const rig = await createRig()
    rig.fake.localNetworkDenied = true
    await expect(
      rig.manager.watchNetwork(() => {}, new AbortController().signal)
    ).rejects.toMatchObject({ code: ErrorCode.LocalNetworkDenied })
  })

  it("doesn't match a signed advert by its MAC when none of its tags is this computer's", async () => {
    const rig = await createRig()
    await openAndClose(rig)
    rig.fake.wifiTxt.set(rig.device.udid, [
      'identifier=0A1B2C3D-4E5F-4A6B-8C7D-9E0F1A2B3C4D',
      'authTag=AAAAAAAAAAA='
    ])
    moveToWifi(rig)

    expect(await rig.manager.discoverNetwork()).toEqual([])
  })

  it('opens no tunnel to a device that is not on Wi-Fi, or has no remote pairing yet', async () => {
    const rig = await createRig()
    await openAndClose(rig)
    expect(await codeOf(rig.manager.openWifiTunnel(rig.device.udid))).toBe(
      ErrorCode.DeviceNotFound
    )

    moveToWifi(rig)
    expect(await codeOf(rig.manager.openWifiTunnel(rig.device.udid))).toBe(
      ErrorCode.DeviceNotPaired
    )
  })
})

/** The rig's device and secrets, with a manager whose log lines are kept, to see which way a session went. */
const loggedManager = (rig: TestRig, makeRemotePairing = false) => {
  const logs: string[] = []
  const keep = (message: string) => {
    logs.push(message)
  }
  const logger: Logger = {
    debug: keep,
    info: keep,
    warn: keep,
    error: keep,
    child: () => logger
  }
  const manager = createDeviceManager({
    transport: rig.fake.transport,
    secrets: rig.secrets,
    logger,
    sleep: () => new Promise((resolve) => setTimeout(resolve, 0)),
    config: { makeRemotePairing }
  })

  return { manager, logs }
}

const saveRemotePairing = (rig: TestRig) =>
  rig.secrets.set(
    remotePairingSecretKey(rig.device.udid),
    serializeRemotePairing({
      identifier: '11C8B687-03B7-9EEB-E19E-B377CF073FB8',
      publicKey: new Uint8Array(32).fill(1),
      privateKey: new Uint8Array(32).fill(2),
      deviceIdentifier: 'E25CE045-BD3B-4838-B9BF-A4882792A653',
      devicePublicKey: new Uint8Array(32).fill(3),
      altIrk: new Uint8Array(16).fill(4)
    })
  )

const startServices = (rig: TestRig) =>
  rig.device.requests.filter((request) => request === 'lockdown:StartService')
    .length

const TUNNEL_FAILED = 'the Wi-Fi tunnel did not open; trying lockdown'

describe('Wi-Fi on iOS 17 and later', () => {
  it('goes through the tunnel first for a device with a remote pairing, and to lockdown when it does not open', async () => {
    const rig = await createRig({ productVersion: '26.6.1' })
    await openAndClose(rig)
    moveToWifi(rig)
    await saveRemotePairing(rig)
    const { manager, logs } = loggedManager(rig)

    const handle = await manager.open(rig.device.udid)
    expect(logs).toContain(TUNNEL_FAILED)
    expect(handle.device).toMatchObject({ address: ADDRESS })
    await handle.close()
  })

  it('opens a device without a remote pairing, or on the wifi route, by lockdown only', async () => {
    const rig = await createRig({ productVersion: '26.6.1' })
    await openAndClose(rig)
    moveToWifi(rig)
    const { manager, logs } = loggedManager(rig)
    await (await manager.open(rig.device.udid)).close()

    await saveRemotePairing(rig)
    await (await manager.open(rig.device.udid, { route: 'wifi' })).close()
    expect(logs).not.toContain(TUNNEL_FAILED)
  })

  it('makes the remote pairing by cable when none is saved, and never fails the session over it', async () => {
    const rig = await createRig({ productVersion: '26.6.1' })
    const { manager, logs } = loggedManager(rig, true)
    const before = startServices(rig)

    const handle = await manager.open(rig.device.udid)
    // The fake device has no remote pairing service: the attempt is made, and only logged.
    expect(startServices(rig)).toBeGreaterThan(before)
    expect(logs).toContain('remote pairing for Wi-Fi skipped')
    await handle.close()
  })

  it('leaves the remote pairing alone when one is saved, or before iOS 17.4', async () => {
    const saved = await createRig({ productVersion: '26.6.1' })
    await saveRemotePairing(saved)
    const old = await createRig({ productVersion: '17.3' })
    for (const rig of [saved, old]) {
      const { manager } = loggedManager(rig, true)
      const before = startServices(rig)
      await (await manager.open(rig.device.udid)).close()
      expect(startServices(rig)).toBe(before)
    }
  })
})
