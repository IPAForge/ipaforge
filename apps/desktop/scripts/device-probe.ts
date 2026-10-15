// Maintainer tool: exercises @loadstar/device against a real iPhone/iPad through the system usbmuxd.
//
//   pnpm --filter @loadstar/desktop device-probe list
//   pnpm --filter @loadstar/desktop device-probe info            [--udid <udid>]
//   pnpm --filter @loadstar/desktop device-probe pair            [--udid <udid>]
//   pnpm --filter @loadstar/desktop device-probe apps            [--udid <udid>]
//   pnpm --filter @loadstar/desktop device-probe profiles        [--udid <udid>]
//   pnpm --filter @loadstar/desktop device-probe install <ipa>   [--udid <udid>]   (the IPA must already be signed)
//   pnpm --filter @loadstar/desktop device-probe targets <TEAMID...>
//   pnpm --filter @loadstar/desktop device-probe pairing-status <TEAMID...>   (which pairing files exist, read-only)
//   pnpm --filter @loadstar/desktop device-probe place <TEAMID...> --yes [--only-missing]   (writes this Mac's pairing file)
//   pnpm --filter @loadstar/desktop device-probe afc-check   (writes, reads back and deletes a file in PublicStaging)
//   pnpm --filter @loadstar/desktop device-probe reveal-devmode
//
// UDIDs are shortened in output unless --show-udid is given. LOG_LEVEL=debug shows protocol traffic (redacted).

import { nodeFileSource } from "@desktop/main/adapters/file-source.ts";
import { createMemorySecretStore } from "@desktop/main/adapters/memory-secret-store.ts";
import { createNodeUsbmuxTransport } from "@desktop/main/adapters/usbmux-transport.ts";
import { createDeviceManager, type DeviceHandle, shortUdid, type UsbmuxDevice } from "@loadstar/device";
import { createLogger, LoadstarError, parseLogLevel, utf8Decode, utf8Encode } from "@loadstar/kernel";

const args = process.argv.slice(2);
const flag = (name: string): boolean => args.includes(`--${name}`);
const option = (name: string): string | undefined => {
  const index = args.indexOf(`--${name}`);
  return index >= 0 ? args[index + 1] : undefined;
};
const positional = args.filter((arg, i) => !arg.startsWith("--") && !args[i - 1]?.startsWith("--udid"));
const [command = "list", ...rest] = positional;
const showUdid = flag("show-udid");
const show = (udid: string): string => (showUdid ? udid : shortUdid(udid));

const logger = createLogger({
  level: parseLogLevel(process.env.LOG_LEVEL, "warn"),
  sink: (record) => console.error(`[${record.level}] ${record.scope ?? ""} ${record.msg}`, record.fields),
});
const manager = createDeviceManager({
  transport: createNodeUsbmuxTransport(),
  secrets: createMemorySecretStore(),
  logger,
});

const pickDevice = async (): Promise<UsbmuxDevice> => {
  const devices = await manager.listDevices();
  const wanted = option("udid");
  const device = wanted ? devices.find((d) => d.udid === wanted) : devices[0];
  if (!device) throw new Error(wanted ? `device ${wanted} not connected` : "no device connected");
  return device;
};

const withDevice = async (run: (handle: DeviceHandle) => Promise<void>): Promise<void> => {
  const device = await pickDevice();
  const handle = await manager.open(device.udid, {
    onProgress: (event) => console.log(`pairing: ${event.stage.replaceAll("_", " ")}`),
  });
  try {
    await run(handle);
  } finally {
    await handle.close();
  }
};

const commands: Record<string, () => Promise<void>> = {
  list: async () => {
    const devices = await manager.listDevices();
    if (devices.length === 0) console.log("no devices");
    for (const device of devices) {
      console.log(`${show(device.udid)}  ${device.connectionType}  paired=${await manager.isPaired(device.udid)}`);
    }
  },
  info: () =>
    withDevice(async (handle) => {
      const check = await handle.check();
      console.log({ ...check.info, udid: show(check.info.udid) });
      console.log({ passcodeSet: check.passcodeSet, developerMode: check.developerMode, activated: check.activated });
    }),
  pair: async () => {
    const device = await pickDevice();
    await manager.pair(device.udid, { onProgress: (e) => console.log(`pairing: ${e.stage.replaceAll("_", " ")}`) });
    console.log("paired");
  },
  apps: () =>
    withDevice(async (handle) => {
      for (const app of await handle.listApps())
        console.log(`${app.bundleId}  ${app.name ?? ""}  ${app.shortVersion ?? ""}`);
    }),
  profiles: () =>
    withDevice(async (handle) => {
      for (const p of await handle.listProfiles()) {
        console.log(`${p.uuid}  ${p.name}  team=${p.teamId ?? "?"}  expires=${p.expirationDate?.toISOString() ?? "?"}`);
      }
    }),
  install: () =>
    withDevice(async (handle) => {
      const path = rest[0];
      if (!path) throw new Error("usage: install <signed.ipa>");
      let last = -1;
      await handle.installIpa(await nodeFileSource(path), {
        onProgress: ({ stage, percent, status }) => {
          if (percent !== last) console.log(`${stage} ${percent}%${status ? ` ${status}` : ""}`);
          last = percent;
        },
      });
    }),
  targets: () =>
    withDevice(async (handle) => {
      for (const t of await handle.pairingTargets(rest)) console.log(`${t.appName}: ${t.bundleId} → ${t.path}`);
    }),
  "pairing-status": () =>
    withDevice(async (handle) => {
      for (const status of await handle.appFileStatus(await handle.pairingTargets(rest))) {
        const when = status.modifiedAt ? ` (modified ${status.modifiedAt.toISOString()})` : "";
        console.log(
          `${status.target.bundleId} ${status.target.path}: ${status.exists ? `${status.size} bytes${when}` : "missing"}`,
        );
      }
    }),
  "afc-check": () =>
    withDevice(async (handle) => {
      const afc = await handle.openMedia();
      const path = `PublicStaging/loadstar-probe-${Date.now()}.txt`;
      const text = `written by Loadstar at ${new Date().toISOString()}`;
      try {
        console.log(`1. PublicStaging exists: ${await afc.exists("PublicStaging")}`);
        if (!(await afc.exists("PublicStaging"))) await afc.mkdir("PublicStaging");
        await afc.writeFile(path, utf8Encode(text));
        console.log(`2. wrote ${path} (${text.length} bytes)`);
        const stat = await afc.stat(path);
        console.log(`3. device reports type=${stat.type} size=${stat.size}`);
        const back = utf8Decode(await afc.readFile(path));
        console.log(`4. read back: "${back}" → ${back === text ? "identical" : "DIFFERENT"}`);
        await afc.remove(path);
        console.log(`5. deleted; exists now: ${await afc.exists(path)}`);
      } finally {
        await afc.close();
      }
    }),
  place: () =>
    withDevice(async (handle) => {
      let targets = await handle.pairingTargets(rest);
      if (flag("only-missing")) {
        const status = await handle.appFileStatus(targets);
        targets = status.filter((s) => !s.exists).map((s) => s.target as (typeof targets)[number]);
        console.log("(--only-missing: existing pairing files are left untouched)");
      }
      if (targets.length === 0) throw new Error("no pairing apps found for these team IDs");
      for (const t of targets) console.log(`${t.appName}: ${t.bundleId} → ${t.path}`);
      if (!flag("yes")) {
        console.log(
          "\nThe pairing file grants access to this device. Re-run with --yes to write it to the apps above.",
        );
        return;
      }
      await handle.placePairingFile(targets);
      for (const status of await handle.appFileStatus(targets)) {
        console.log(`${status.target.path}: ${status.exists ? `${status.size} bytes` : "missing"}`);
      }
    }),
  "reveal-devmode": () =>
    withDevice(async (handle) => {
      await handle.revealDeveloperMode();
      console.log("Developer Mode is now visible in Settings › Privacy & Security.");
    }),
};

const run = commands[command];
if (!run) {
  console.error(`unknown command "${command}"; one of: ${Object.keys(commands).join(", ")}`);
  process.exit(2);
}
try {
  await run();
} catch (error) {
  if (error instanceof LoadstarError) console.error(`${error.code}: ${error.message}`, error.data ?? "");
  else console.error(error);
  process.exit(1);
}
