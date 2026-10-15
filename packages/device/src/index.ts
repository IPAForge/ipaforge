// Public API of @loadstar/device: talks to iPhones and iPads through the system usbmuxd.
export type { AppFileStatus, AppFileTarget, PlacePairingOptions } from "@device/application/app-files.ts";
export { assertCanRunSideloadedApps, type DeveloperModeState, type DeviceCheck } from "@device/application/checks.ts";
export type { InstallIpaOptions, InstallIpaProgress, InstallStage } from "@device/application/install.ts";
export {
  createDeviceManager,
  type DeviceHandle,
  type DeviceManager,
  type PairingTarget,
} from "@device/application/manager.ts";
export { type PairingProgress, type PairOptions, pairRecordSecretKey } from "@device/application/pair.ts";
export { type RemoveStaleOptions, staleProfiles } from "@device/application/profiles.ts";
export type { DeviceSession, OpenSessionOptions, StartServiceOptions } from "@device/application/session.ts";
export { type DeviceDeps, type DeviceDepsInput, realSleep, type Sleep } from "@device/deps.ts";
export { DEFAULT_DEVICE_CONFIG, type DeviceConfig, resolveDeviceConfig } from "@device/domain/config.ts";
export { LOCKDOWN_PORT, Service } from "@device/domain/constants.ts";
export {
  type ConnectionType,
  type DeviceEvent,
  type DeviceInfo,
  parseVersion,
  shortUdid,
  type UsbmuxDevice,
} from "@device/domain/device.ts";
export { classifyInstallError, InstalldCode, type InstallFailure } from "@device/domain/install-errors.ts";
export {
  type PairRecord,
  pairingFile,
  parsePairRecord,
  serializePairRecord,
  tlsCredentials,
} from "@device/domain/pairing/pair-record.ts";
export { decodePem, encodePem } from "@device/domain/pairing/pem.ts";
export {
  type FindPairingAppsOptions,
  findPairingApps,
  matchesBundleId,
  PAIRING_APPS,
  type PairingApp,
  type PairingAppMatch,
} from "@device/domain/pairing-apps.ts";
export type { Connection, DeviceTransport, TlsCredentials } from "@device/domain/ports/transport.ts";
export { bundleIdOf, type DeviceProfile, summarizeProfile } from "@device/domain/profiles.ts";
export type { AfcClient, AfcStat } from "@device/infrastructure/afc/client.ts";
export type { ContainerMode } from "@device/infrastructure/house-arrest/client.ts";
export type {
  ApplicationType,
  InstalledApp,
  InstallProgress,
} from "@device/infrastructure/installation-proxy/client.ts";
export { createPairRecord } from "@device/infrastructure/pairing/certificates.ts";
