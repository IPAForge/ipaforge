// A device session with every capability the installer needs, each delegating to its use-case module.
import {
  appFileStatus,
  readAppFile,
  removeAppFile,
  writeAppFile
} from '@device/application/app-files.ts'
import { listApps, lookupApps, uninstallApp } from '@device/application/apps.ts'
import { checkDevice } from '@device/application/checks.ts'
import type { DeviceContext } from '@device/application/context.ts'
import { installIpa } from '@device/application/install.ts'
import {
  pairingFileData,
  pairingTargets,
  placePairingFile
} from '@device/application/pairing-file.ts'
import {
  installProfile,
  listProfiles,
  removeProfile,
  removeStaleProfiles
} from '@device/application/profiles.ts'
import {
  checkRemotePairing,
  ensureRemotePairing
} from '@device/application/remote-pairing.ts'
import { openAfc, revealDeveloperMode } from '@device/application/services.ts'
import type {
  AppFileStatus,
  AppFileTarget,
  DeviceCheck,
  DeviceSession,
  InstallIpaOptions,
  PairingTarget,
  PlacedPairing,
  PlacePairingOptions,
  RemotePairingOptions,
  RemotePairingResult,
  RemotePairingState
} from '@device/application/types.ts'
import type { PairRecord } from '@device/domain/pairing/types.ts'
import type {
  DeviceProfile,
  RemoveStaleOptions,
  UsbmuxDevice
} from '@device/domain/types.ts'
import type { AfcClient } from '@device/infrastructure/afc/types.ts'
import type { InstalledApp } from '@device/infrastructure/installation-proxy/apps.ts'
import type { ApplicationType } from '@device/infrastructure/installation-proxy/types.ts'
import type { FileSource } from '@ipaforge/kernel'

/** A device session with every capability the installer needs. */
export type DeviceHandle = {
  readonly device: UsbmuxDevice
  /** The classic pairing; a device paired by code (Apple TV, Vision Pro) has none. */
  readonly pairRecord?: PairRecord | undefined
  check(): Promise<DeviceCheck>
  installIpa(ipa: FileSource, options?: InstallIpaOptions): Promise<void>
  uninstall(bundleId: string): Promise<void>
  listApps(applicationType?: ApplicationType): Promise<InstalledApp[]>
  lookupApps(bundleIds: readonly string[]): Promise<Map<string, InstalledApp>>
  listProfiles(): Promise<DeviceProfile[]>
  installProfile(profile: Uint8Array): Promise<void>
  removeProfile(uuid: string): Promise<void>
  removeStaleProfiles(options: RemoveStaleOptions): Promise<DeviceProfile[]>
  writeAppFile(target: AppFileTarget, data: Uint8Array): Promise<void>
  readAppFile(target: AppFileTarget): Promise<Uint8Array>
  /**
   * Pairing-file locations of the known pairing apps installed on the device (SideStore, LiveContainer, …),
   * counting sideloaded copies only from `teamIds` (the user's own teams). Show them to the user to confirm.
   */
  pairingTargets(teamIds: Iterable<string>): Promise<PairingTarget[]>
  /**
   * Writes this host's pairing file to the confirmed `targets`, enabling Wi-Fi debugging first, and verifies
   * each write, and on iOS 17.4 and later SideStore's remote pairing next to it. The file grants lockdown access, so
   * targets are always explicit. Returns what was written.
   */
  placePairingFile(
    targets: readonly AppFileTarget[],
    options?: PlacePairingOptions
  ): Promise<PlacedPairing>
  appFileStatus(targets: readonly AppFileTarget[]): Promise<AppFileStatus[]>
  /** Deletes a file from an app's container (nothing happens when it isn't there). */
  removeAppFile(target: AppFileTarget): Promise<void>
  /** This host's pairing file for the device, for saving to the computer (another tool asks for it). */
  pairingFileData(): Promise<Uint8Array>
  revealDeveloperMode(): Promise<void>
  /** The device's media file system (`/var/mobile/Media`, incl. `PublicStaging`). Close it when done. */
  openMedia(): Promise<AfcClient>
  /** Lets SideStore and other on-device tools reach lockdownd over Wi-Fi/VPN. Needs a passcode on the device. */
  enableWifiDebugging(): Promise<void>
  /**
   * The remote pairing (iOS 17.4 and later) for SideStore: the saved one when the device still accepts it, else a
   * new one, which may show the Trust prompt.
   */
  remotePairing(options?: RemotePairingOptions): Promise<RemotePairingResult>
  /** Whether the device accepts this computer's saved remote pairing (read-only). */
  checkRemotePairing(): Promise<RemotePairingState>
  /** The low-level session, for anything not covered above. */
  readonly session: DeviceSession
  close(): Promise<void>
}

export const createDeviceHandle = (
  ctx: DeviceContext,
  session: DeviceSession
): DeviceHandle => ({
  device: session.device,
  pairRecord: session.pairRecord,
  session,
  check: () => checkDevice(session),
  installIpa: (ipa, options) => installIpa(ctx, session, ipa, options),
  uninstall: (bundleId) => uninstallApp(ctx, session, bundleId),
  listApps: (applicationType) => listApps(ctx, session, applicationType),
  lookupApps: (bundleIds) => lookupApps(ctx, session, bundleIds),
  listProfiles: () => listProfiles(ctx, session),
  installProfile: (profile) => installProfile(ctx, session, profile),
  removeProfile: (uuid) => removeProfile(ctx, session, uuid),
  removeStaleProfiles: (options) => removeStaleProfiles(ctx, session, options),
  writeAppFile: (target, data) => writeAppFile(ctx, session, target, data),
  readAppFile: (target) => readAppFile(ctx, session, target),
  pairingTargets: (teamIds) => pairingTargets(ctx, session, teamIds),
  placePairingFile: (targets, options) =>
    placePairingFile(ctx, session, targets, options),
  appFileStatus: (targets) => appFileStatus(ctx, session, targets),
  removeAppFile: (target) => removeAppFile(ctx, session, target),
  pairingFileData: () => pairingFileData(session),
  revealDeveloperMode: () => revealDeveloperMode(ctx, session),
  openMedia: () => openAfc(ctx, session),
  enableWifiDebugging: () => session.enableWifiDebugging(),
  remotePairing: (options) => ensureRemotePairing(ctx, session, options),
  checkRemotePairing: () => checkRemotePairing(ctx, session),
  close: () => session.close()
})
