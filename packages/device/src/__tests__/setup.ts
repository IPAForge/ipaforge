// Test-only: a DeviceManager wired to a fake usbmuxd with a fake clock and instant sleeps.

import {
  createFakeDevice,
  createFakeUsbmuxd,
  type FakeDevice,
  type FakeDeviceOptions,
  type FakeUsbmuxd,
  memorySecrets,
} from "@device/__tests__/fake-device/fake-device.ts";
import { createDeviceManager, type DeviceManager } from "@device/application/manager.ts";
import type { DeviceConfig } from "@device/domain/config.ts";
import type { Clock } from "@loadstar/kernel";

export interface TestRig {
  readonly fake: FakeUsbmuxd;
  readonly device: FakeDevice;
  readonly manager: DeviceManager;
  readonly secrets: ReturnType<typeof memorySecrets>;
  readonly sleeps: number[];
}

export const createRig = async (
  options: FakeDeviceOptions = {},
  config: Partial<DeviceConfig> = {},
): Promise<TestRig> => {
  const device = await createFakeDevice(options);
  const fake = createFakeUsbmuxd([device]);
  const secrets = memorySecrets();
  let now = new Date("2026-10-15T12:00:00Z").getTime();
  const clock: Clock = { now: () => new Date(now) };
  const sleeps: number[] = [];
  const manager = createDeviceManager({
    transport: fake.transport,
    secrets,
    clock,
    sleep: async (ms) => {
      sleeps.push(ms);
      now += ms;
    },
    config,
  });
  return { fake, device, manager, secrets, sleeps };
};
