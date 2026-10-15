import {
  type AppFileStatus,
  type AppFileTarget,
  appFileStatus,
  type PlacePairingOptions,
  placePairingFile,
  readAppFile,
  writeAppFile,
} from "@device/application/app-files.ts";
import { checkDevice, type DeviceCheck } from "@device/application/checks.ts";
import { createDeviceContext, type DeviceContext } from "@device/application/context.ts";
import { type InstallIpaOptions, installIpa } from "@device/application/install.ts";
import {
  exportPairRecord,
  getPairRecord,
  importPairRecord,
  type PairOptions,
  pairDevice,
} from "@device/application/pair.ts";
import {
  installProfile,
  listProfiles,
  type RemoveStaleOptions,
  removeProfile,
  removeStaleProfiles,
} from "@device/application/profiles.ts";
import { openAfc, openInstallationProxy, revealDeveloperMode, withClient } from "@device/application/services.ts";
import { type DeviceSession, type OpenSessionOptions, openSession } from "@device/application/session.ts";
import { type DeviceDepsInput, resolveDeviceDeps } from "@device/deps.ts";
import { type DeviceEvent, shortUdid, type UsbmuxDevice } from "@device/domain/device.ts";
import type { PairRecord } from "@device/domain/pairing/pair-record.ts";
import { findPairingApps } from "@device/domain/pairing-apps.ts";
import type { DeviceProfile } from "@device/domain/profiles.ts";
import type { AfcClient } from "@device/infrastructure/afc/client.ts";
import type { ApplicationType, InstalledApp } from "@device/infrastructure/installation-proxy/client.ts";
import type { FileSource } from "@loadstar/kernel";
import { ErrorCode, LoadstarError } from "@loadstar/kernel";

/** A device session with every capability the installer needs. */
export interface DeviceHandle {
  readonly device: UsbmuxDevice;
  readonly pairRecord: PairRecord;
  check(): Promise<DeviceCheck>;
  installIpa(ipa: FileSource, options?: InstallIpaOptions): Promise<void>;
  uninstall(bundleId: string): Promise<void>;
  listApps(applicationType?: ApplicationType): Promise<InstalledApp[]>;
  lookupApps(bundleIds: readonly string[]): Promise<Map<string, InstalledApp>>;
  listProfiles(): Promise<DeviceProfile[]>;
  installProfile(profile: Uint8Array): Promise<void>;
  removeProfile(uuid: string): Promise<void>;
  removeStaleProfiles(options: RemoveStaleOptions): Promise<DeviceProfile[]>;
  writeAppFile(target: AppFileTarget, data: Uint8Array): Promise<void>;
  readAppFile(target: AppFileTarget): Promise<Uint8Array>;
  /**
   * Pairing-file locations of the known pairing apps installed on the device (SideStore, LiveContainer, …),
   * counting sideloaded copies only from `teamIds` (the user's own teams). Show them to the user to confirm.
   */
  pairingTargets(teamIds: Iterable<string>): Promise<PairingTarget[]>;
  /**
   * Writes this host's pairing file to the confirmed `targets`, enabling Wi-Fi debugging first, and verifies
   * each write. The file grants lockdown access, so targets are always explicit. Returns the targets written.
   */
  placePairingFile(targets: readonly AppFileTarget[], options?: PlacePairingOptions): Promise<readonly AppFileTarget[]>;
  appFileStatus(targets: readonly AppFileTarget[]): Promise<AppFileStatus[]>;
  revealDeveloperMode(): Promise<void>;
  /** The device's media file system (`/var/mobile/Media`, incl. `PublicStaging`). Close it when done. */
  openMedia(): Promise<AfcClient>;
  /** Lets SideStore and other on-device tools reach lockdownd over Wi-Fi/VPN. Needs a passcode on the device. */
  enableWifiDebugging(): Promise<void>;
  /** The low-level session, for anything not covered above. */
  readonly session: DeviceSession;
  close(): Promise<void>;
}

export interface DeviceManager {
  listDevices(): Promise<UsbmuxDevice[]>;
  /** Streams attach/detach events until `signal` aborts. */
  watch(onEvent: (event: DeviceEvent) => void, signal: AbortSignal): Promise<void>;
  pair(udid: string, options?: PairOptions): Promise<PairRecord>;
  isPaired(udid: string): Promise<boolean>;
  exportPairRecord(udid: string): Promise<Uint8Array>;
  importPairRecord(udid: string, data: Uint8Array): Promise<void>;
  open(udid: string, options?: OpenSessionOptions): Promise<DeviceHandle>;
}

const findDevice = async (ctx: DeviceContext, udid: string): Promise<UsbmuxDevice> => {
  const device = (await ctx.usbmux.listDevices()).find((candidate) => candidate.udid === udid);
  if (!device) throw new LoadstarError(ErrorCode.DeviceNotFound, { data: { device: shortUdid(udid) } });
  return device;
};

/** A pairing-file location, with the app it belongs to (for the confirmation shown to the user). */
export interface PairingTarget extends AppFileTarget {
  readonly appName: string;
}

const pairingTargets = async (
  ctx: DeviceContext,
  session: DeviceSession,
  teamIds: Iterable<string>,
): Promise<PairingTarget[]> => {
  const apps = await withClient(await openInstallationProxy(ctx, session), (proxy) => proxy.browse());
  return findPairingApps(
    apps.map((app) => app.bundleId),
    { teamIds },
  ).flatMap(({ app, bundleId }) => app.files.map((path) => ({ bundleId, path, appName: app.name })));
};

const handleFor = (ctx: DeviceContext, session: DeviceSession): DeviceHandle => ({
  device: session.device,
  pairRecord: session.pairRecord,
  session,
  check: () => checkDevice(session),
  installIpa: (ipa, options) => installIpa(ctx, session, ipa, options),
  uninstall: async (bundleId) =>
    withClient(await openInstallationProxy(ctx, session), (proxy) => proxy.uninstall(bundleId)),
  listApps: async (applicationType) =>
    withClient(await openInstallationProxy(ctx, session), (proxy) =>
      proxy.browse(applicationType ? { applicationType } : {}),
    ),
  lookupApps: async (bundleIds) =>
    withClient(await openInstallationProxy(ctx, session), (proxy) => proxy.lookup(bundleIds)),
  listProfiles: () => listProfiles(ctx, session),
  installProfile: (profile) => installProfile(ctx, session, profile),
  removeProfile: (uuid) => removeProfile(ctx, session, uuid),
  removeStaleProfiles: (options) => removeStaleProfiles(ctx, session, options),
  writeAppFile: (target, data) => writeAppFile(ctx, session, target, data),
  readAppFile: (target) => readAppFile(ctx, session, target),
  pairingTargets: (teamIds) => pairingTargets(ctx, session, teamIds),
  placePairingFile: async (targets, options) => {
    await placePairingFile(ctx, session, targets, options);
    return targets;
  },
  appFileStatus: (targets) => appFileStatus(ctx, session, targets),
  revealDeveloperMode: () => revealDeveloperMode(ctx, session),
  openMedia: () => openAfc(ctx, session),
  enableWifiDebugging: () => session.enableWifiDebugging(),
  close: () => session.close(),
});

export const createDeviceManager = (input: DeviceDepsInput): DeviceManager => {
  const ctx = createDeviceContext(resolveDeviceDeps(input));
  return {
    listDevices: () => ctx.usbmux.listDevices(),
    watch: (onEvent, signal) => ctx.usbmux.listen(onEvent, signal),
    pair: async (udid, options) => pairDevice(ctx, await findDevice(ctx, udid), options),
    isPaired: async (udid) => (await getPairRecord(ctx, udid)) !== undefined,
    exportPairRecord: async (udid) => {
      const record = await getPairRecord(ctx, udid);
      if (!record) throw new LoadstarError(ErrorCode.DeviceNotPaired, { data: { device: shortUdid(udid) } });
      return exportPairRecord(record);
    },
    importPairRecord: async (udid, data) => {
      await importPairRecord(ctx, udid, data);
    },
    open: async (udid, options) => handleFor(ctx, await openSession(ctx, await findDevice(ctx, udid), options)),
  };
};
