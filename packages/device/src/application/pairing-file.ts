// The pairing file on-device tools (SideStore, StikDebug, …) use to reach lockdownd: where it goes and placing it.
import { type AppFileTarget, writeAppFile } from "@device/application/app-files.ts";
import { installedBundleIds } from "@device/application/apps.ts";
import type { DeviceContext } from "@device/application/context.ts";
import type { DeviceSession } from "@device/application/session.ts";
import { pairingFile } from "@device/domain/pairing/pair-record.ts";
import { findPairingApps } from "@device/domain/pairing-apps.ts";

/** A pairing-file location, with the app it belongs to (for the confirmation shown to the user). */
export interface PairingTarget extends AppFileTarget {
  readonly appName: string;
}

export interface PlacePairingOptions {
  /**
   * Turn on Wi-Fi debugging first (default true). On-device tools (SideStore, StikDebug) reach lockdownd over
   * Wi-Fi/VPN with this file, which only works once it is enabled; it fails without a passcode.
   */
  readonly enableWifiDebugging?: boolean;
}

/** Pairing-file locations of the known pairing apps installed on the device (sideloaded copies only from `teamIds`). */
export const pairingTargets = async (
  ctx: DeviceContext,
  session: DeviceSession,
  teamIds: Iterable<string>,
): Promise<PairingTarget[]> =>
  findPairingApps(await installedBundleIds(ctx, session), { teamIds }).flatMap(({ app, bundleId }) =>
    app.files.map((path) => ({ bundleId, path, appName: app.name })),
  );

/** Places this host's pairing file (pair record + UDID) at each target, verifying every write. */
export const placePairingFile = async (
  ctx: DeviceContext,
  session: DeviceSession,
  targets: readonly AppFileTarget[],
  options: PlacePairingOptions = {},
): Promise<void> => {
  if (options.enableWifiDebugging ?? true) await session.enableWifiDebugging();
  const data = pairingFile(session.pairRecord, session.device.udid);
  for (const target of targets) await writeAppFile(ctx, session, target, data);
};
