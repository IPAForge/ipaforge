// Real-hardware suite. Needs a trusted iPhone/iPad visible to usbmuxd (USB or Wi-Fi sync):
//   LOADSTAR_DEVICE=1 pnpm vitest run apps/desktop/src/main/adapters/device.hardware.test.ts
// Read-only by default. LOADSTAR_DEVICE_WRITE=1 also writes and removes a small file in PublicStaging.

import { createMemorySecretStore } from "@desktop/main/adapters/memory-secret-store.ts";
import { createNodeUsbmuxTransport } from "@desktop/main/adapters/usbmux-transport.ts";
import { createDeviceManager, type DeviceHandle, PAIRING_APPS } from "@loadstar/device";
import { utf8Decode, utf8Encode } from "@loadstar/kernel";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

describe.skipIf(!process.env.LOADSTAR_DEVICE)("real device (LOADSTAR_DEVICE=1)", { timeout: 60_000 }, () => {
  const manager = createDeviceManager({ transport: createNodeUsbmuxTransport(), secrets: createMemorySecretStore() });
  let handle: DeviceHandle;

  beforeAll(async () => {
    const [device] = await manager.listDevices();
    if (!device) throw new Error("connect and trust a device first");
    handle = await manager.open(device.udid, { autoPair: false });
  });
  afterAll(() => handle?.close());

  it("reads identity, passcode and Developer Mode", async () => {
    const check = await handle.check();
    expect(check.info.udid).toBe(handle.device.udid);
    expect(check.info.productVersion).toMatch(/^\d+\.\d+/);
    expect(["on", "off", "not_required", "unknown"]).toContain(check.developerMode);
  });

  it("lists user apps and provisioning profiles", async () => {
    const apps = await handle.listApps();
    expect(apps.every((app) => app.bundleId.length > 0)).toBe(true);
    const profiles = await handle.listProfiles();
    expect(profiles.every((profile) => profile.uuid.length > 0)).toBe(true);
  });

  it("reads pairing-file status of installed pairing apps", async () => {
    const apps = await handle.listApps();
    const teams = new Set(
      apps.flatMap((app) =>
        PAIRING_APPS.filter((p) => app.bundleId.startsWith(`${p.bundleId}.`)).map((p) =>
          app.bundleId.slice(p.bundleId.length + 1),
        ),
      ),
    );
    const targets = await handle.pairingTargets(teams);
    const status = await handle.appFileStatus(targets);
    expect(status).toHaveLength(targets.length);
  });

  it.skipIf(!process.env.LOADSTAR_DEVICE_WRITE)("round-trips a file through AFC in PublicStaging", async () => {
    const afc = await handle.openMedia();
    try {
      const path = `PublicStaging/loadstar-${Date.now()}.txt`;
      if (!(await afc.exists("PublicStaging"))) await afc.mkdir("PublicStaging");
      await afc.writeFile(path, utf8Encode("loadstar"));
      expect(utf8Decode(await afc.readFile(path))).toBe("loadstar");
      await afc.remove(path);
      expect(await afc.exists(path)).toBe(false);
    } finally {
      await afc.close();
    }
  });
});
