// Pairing an Apple TV or Vision Pro by the code it shows, against a fake one on the fake network: found while its
// pairing screen is open, paired with the right code (never with a wrong one), found again by its remote pairing
// advert, and forgotten.
import { describe, expect, it } from 'vitest'

import { PAIRING_ADVERT_PORT } from '@device/__tests__/fake-device/fake-device.ts'
import {
  createFakeRemoteDevice,
  DEVICE_ALT_IRK
} from '@device/__tests__/fake-remote-device.ts'
import { createRig, type TestRig } from '@device/__tests__/setup.ts'
import { remotePairingSecretKey } from '@device/domain/remote-pairing/record.ts'
import type {
  DeviceEvent,
  PairableDevice,
  PairableEvent
} from '@device/domain/types.ts'
import { MANUAL_PAIRING_SERVICE } from '@device/infrastructure/mdns/constants.ts'
import { remoteAuthTag } from '@device/infrastructure/mdns/remote-auth-tag.ts'
import { ErrorCode, toBase64 } from '@ipaforge/kernel'

const TV_ADDRESS = '192.0.2.20'
const CODE = '482913'
const TV_UDID = '00008110-0012345678ABCDEF'

const showPairingScreen = (
  rig: TestRig,
  options: Parameters<typeof createFakeRemoteDevice>[0] = {}
) => {
  const device = createFakeRemoteDevice({
    pin: CODE,
    model: 'AppleTV14,1',
    name: 'Living Room',
    udid: TV_UDID,
    ...options
  })
  rig.fake.pairable.set(TV_ADDRESS, {
    txt: ['name=Living Room', 'model=AppleTV14,1'],
    device
  })
  return device
}

const firstPairable = async (rig: TestRig): Promise<PairableDevice> => {
  const controller = new AbortController()
  let found: PairableDevice | undefined
  await rig.manager.watchPairable((event: PairableEvent) => {
    if (event.kind !== 'found') return
    found = event.device
    controller.abort()
  }, controller.signal)
  if (!found) throw new Error('nothing found')
  return found
}

const TARGET: PairableDevice = {
  id: `tv@fe80::1-supportsRP-24.${MANUAL_PAIRING_SERVICE}`,
  name: 'Living Room',
  model: 'AppleTV14,1',
  address: TV_ADDRESS,
  port: PAIRING_ADVERT_PORT
}

describe('pairing an Apple TV or Vision Pro by code', () => {
  it('finds a device showing its pairing screen, with its name, model and pairing port', async () => {
    const rig = await createRig()
    showPairingScreen(rig)

    expect(await firstPairable(rig)).toEqual(TARGET)
  })

  it('pairs with the code it shows, and remembers it with its remote pairing', async () => {
    const rig = await createRig()
    showPairingScreen(rig)

    const paired = await rig.manager.pairByCode(TARGET, async () => CODE)
    expect(paired).toEqual({
      udid: TV_UDID,
      name: 'Living Room',
      model: 'AppleTV14,1'
    })
    expect(await rig.manager.codePairedDevices()).toEqual([paired])
    expect(await rig.secrets.get(remotePairingSecretKey(TV_UDID))).toBeDefined()
  })

  it('saves nothing when the code is wrong, and says so', async () => {
    const rig = await createRig()
    showPairingScreen(rig)

    await expect(
      rig.manager.pairByCode(TARGET, async () => '111111')
    ).rejects.toMatchObject({ code: ErrorCode.PairingCodeWrong })
    expect(await rig.manager.codePairedDevices()).toEqual([])
  })

  it('says the pairing screen closed when the device no longer takes the connection', async () => {
    const rig = await createRig()

    await expect(
      rig.manager.pairByCode(TARGET, async () => CODE)
    ).rejects.toMatchObject({ code: ErrorCode.PairingScreenClosed })
  })

  it('finds a paired device again by its remote pairing advert, and ignores one signed with another key', async () => {
    const rig = await createRig()
    showPairingScreen(rig)
    await rig.manager.pairByCode(TARGET, async () => CODE)
    rig.fake.pairable.clear()
    const identifier = '62067C5A-F441-400F-8F91-8BE697BC3F32'
    rig.fake.remotePairingAdverts.set('192.0.2.30', [
      `identifier=${identifier}`,
      `authTag=${toBase64(remoteAuthTag(new Uint8Array(16).fill(9), identifier))}`
    ])
    rig.fake.remotePairingAdverts.set(TV_ADDRESS, [
      `identifier=${identifier}`,
      `authTag=${toBase64(remoteAuthTag(DEVICE_ALT_IRK, identifier))}`
    ])

    const events: DeviceEvent[] = []
    const controller = new AbortController()
    await rig.manager.watchNetwork((event) => {
      events.push(event)
      controller.abort()
    }, controller.signal)
    expect(events).toEqual([
      {
        kind: 'attached',
        device: {
          udid: TV_UDID,
          deviceId: expect.any(Number),
          connectionType: 'network',
          address: TV_ADDRESS,
          pairedByCode: true
        }
      }
    ])
  })

  it('forgets a paired device: its pairing and its place in the list', async () => {
    const rig = await createRig()
    showPairingScreen(rig)
    await rig.manager.pairByCode(TARGET, async () => CODE)

    await rig.manager.forgetCodePaired(TV_UDID)
    expect(await rig.manager.codePairedDevices()).toEqual([])
    expect(
      await rig.secrets.get(remotePairingSecretKey(TV_UDID))
    ).toBeUndefined()
  })

  it("refuses a device that gives the UDID of one paired another way, keeping that one's pairing", async () => {
    const rig = await createRig()
    // The cabled fake device (UDID), trusted by the OS, with a remote pairing of its own.
    await rig.secrets.set(remotePairingSecretKey('UDID'), new Uint8Array([1]))
    showPairingScreen(rig, { udid: 'UDID' })

    await expect(
      rig.manager.pairByCode(TARGET, async () => CODE)
    ).rejects.toMatchObject({ code: ErrorCode.DeviceProtocolError })
    expect(await rig.manager.codePairedDevices()).toEqual([])
    expect(await rig.secrets.get(remotePairingSecretKey('UDID'))).toEqual(
      new Uint8Array([1])
    )
  })

  it('forgets only devices paired by code, never an iPhone', async () => {
    const rig = await createRig()
    await rig.secrets.set(remotePairingSecretKey('UDID'), new Uint8Array([1]))

    await rig.manager.forgetCodePaired('UDID')
    expect(await rig.secrets.get(remotePairingSecretKey('UDID'))).toEqual(
      new Uint8Array([1])
    )
  })
})
