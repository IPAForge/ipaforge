// Test-only: a DeviceManager wired to a fake usbmuxd (and a fake Wi-Fi) with a fake clock and instant sleeps.

import {
  createFakeDevice,
  createFakeUsbmuxd,
  type FakeDevice,
  type FakeDeviceOptions,
  type FakeUsbmuxd,
  type FakeUsbmuxdOptions,
  memorySecrets
} from '@device/__tests__/fake-device/fake-device.ts'
import {
  createDeviceManager,
  type DeviceManager
} from '@device/application/manager.ts'
import type { DeviceConfig } from '@device/domain/config.ts'
import type { Clock } from '@ipaforge/kernel'

export type TestRig = {
  readonly fake: FakeUsbmuxd
  readonly device: FakeDevice
  readonly manager: DeviceManager
  readonly secrets: ReturnType<typeof memorySecrets>
  readonly sleeps: number[]
}

/** By default the OS already trusts the device: its pair record is there the first time it is read. */
const OS_ALREADY_PAIRED: FakeUsbmuxdOptions = { osPairsAfterMisses: 0 }

export const createRig = async (
  options: FakeDeviceOptions = {},
  config: Partial<DeviceConfig> = {},
  usbmux: FakeUsbmuxdOptions = OS_ALREADY_PAIRED
): Promise<TestRig> => {
  const device = await createFakeDevice(options)
  const fake = createFakeUsbmuxd([device], usbmux)
  const secrets = memorySecrets()
  let now = new Date('2026-10-15T12:00:00Z').getTime()
  const clock: Clock = { now: () => new Date(now) }
  const sleeps: number[] = []
  const manager = createDeviceManager({
    transport: fake.transport,
    secrets,
    clock,
    sleep: async (ms) => {
      sleeps.push(ms)
      now += ms
      // Instant, but a real turn of the event loop, so work that isn't a microtask (WebCrypto) still runs.
      await new Promise((resolve) => setTimeout(resolve, 0))
    },
    // The fake device has no remote pairing service on lockdown: tests that want one turn this back on.
    config: { makeRemotePairing: false, ...config }
  })

  return { fake, device, manager, secrets, sleeps }
}
