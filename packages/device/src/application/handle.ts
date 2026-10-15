// A device session with every capability the installer needs, each delegating to its use-case module.
import {
  type AppFileStatus,
  type AppFileTarget,
  appFileStatus,
  readAppFile,
  writeAppFile
} from '@device/application/app-files.ts'
import { listApps, lookupApps, uninstallApp } from '@device/application/apps.ts'
import { checkDevice, type DeviceCheck } from '@device/application/checks.ts'
import type { DeviceContext } from '@device/application/context.ts'
import {
  type InstallIpaOptions,
  installIpa
} from '@device/application/install.ts'
import {
  type PairingTarget,
  type PlacePairingOptions,
  pairingTargets,
  placePairingFile
} from '@device/application/pairing-file.ts'
import {
  installProfile,
  listProfiles,
  removeProfile,
  removeStaleProfiles
} from '@device/application/profiles.ts'
import { openAfc, revealDeveloperMode } from '@device/application/services.ts'
import type { DeviceSession } from '@device/application/session.ts'
import type { UsbmuxDevice } from '@device/domain/device.ts'
import type { PairRecord } from '@device/domain/pairing/pair-record.ts'
import type {
  DeviceProfile,
  RemoveStaleOptions
} from '@device/domain/profiles.ts'
import type { AfcClient } from '@device/infrastructure/afc/client.ts'
import type { InstalledApp } from '@device/infrastructure/installation-proxy/apps.ts'
import type { ApplicationType } from '@device/infrastructure/installation-proxy/client.ts'
import type { FileSource } from '@loadstar/kernel'

/** A device session with every capability the installer needs. */
export type DeviceHandle = {
  readonly device: UsbmuxDevice
  readonly pairRecord: PairRecord
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
   * each write. The file grants lockdown access, so targets are always explicit. Returns the targets written.
   */
  placePairingFile(
    targets: readonly AppFileTarget[],
    options?: PlacePairingOptions
  ): Promise<readonly AppFileTarget[]>
  appFileStatus(targets: readonly AppFileTarget[]): Promise<AppFileStatus[]>
  revealDeveloperMode(): Promise<void>
  /** The device's media file system (`/var/mobile/Media`, incl. `PublicStaging`). Close it when done. */
  openMedia(): Promise<AfcClient>
  /** Lets SideStore and other on-device tools reach lockdownd over Wi-Fi/VPN. Needs a passcode on the device. */
  enableWifiDebugging(): Promise<void>
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
  placePairingFile: async (targets, options) => {
    await placePairingFile(ctx, session, targets, options)
    return targets
  },
  appFileStatus: (targets) => appFileStatus(ctx, session, targets),
  revealDeveloperMode: () => revealDeveloperMode(ctx, session),
  openMedia: () => openAfc(ctx, session),
  enableWifiDebugging: () => session.enableWifiDebugging(),
  close: () => session.close()
})
