// device-probe commands for the pairing file inside pairing apps: targets, pairing-status, place.
import type { DeviceProbe } from "@desktop/probes/device/context.ts";
import type { DeviceHandle, PairingTarget } from "@loadstar/device";

const printTargets = (targets: readonly PairingTarget[]) => {
  for (const t of targets) console.log(`${t.appName}: ${t.bundleId} → ${t.path}`);
};

/** The targets that have no pairing file yet. */
const missingTargets = async (handle: DeviceHandle, targets: PairingTarget[]): Promise<PairingTarget[]> => {
  const status = await handle.appFileStatus(targets);
  return status.filter((s) => !s.exists).map((s) => s.target as PairingTarget);
};

export const targetsCommand =
  ({ withDevice, args }: DeviceProbe) =>
  (): Promise<void> =>
    withDevice(async (handle) => printTargets(await handle.pairingTargets(args.rest)));

/** Read-only: which pairing files exist. */
export const pairingStatusCommand =
  ({ withDevice, args }: DeviceProbe) =>
  (): Promise<void> =>
    withDevice(async (handle) => {
      for (const status of await handle.appFileStatus(await handle.pairingTargets(args.rest))) {
        const when = status.modifiedAt ? ` (modified ${status.modifiedAt.toISOString()})` : "";
        console.log(
          `${status.target.bundleId} ${status.target.path}: ${status.exists ? `${status.size} bytes${when}` : "missing"}`,
        );
      }
    });

/** Writes this computer's pairing file into the pairing apps; only with --yes. */
export const placeCommand =
  ({ withDevice, args }: DeviceProbe) =>
  (): Promise<void> =>
    withDevice(async (handle) => {
      let targets = await handle.pairingTargets(args.rest);
      if (args.flag("only-missing")) {
        targets = await missingTargets(handle, targets);
        console.log("(--only-missing: existing pairing files are left untouched)");
      }
      if (targets.length === 0) throw new Error("no pairing apps found for these team IDs");
      printTargets(targets);
      if (!args.flag("yes")) {
        console.log(
          "\nThe pairing file grants access to this device. Re-run with --yes to write it to the apps above.",
        );
        return;
      }
      await handle.placePairingFile(targets);
      for (const status of await handle.appFileStatus(targets)) {
        console.log(`${status.target.path}: ${status.exists ? `${status.size} bytes` : "missing"}`);
      }
    });
