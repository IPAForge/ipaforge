// Public API of @loadstar/device: talks to iPhones and iPads through the system usbmuxd.

export { assertCanRunSideloadedApps } from '@device/application/checks.ts'
export type { DeviceHandle } from '@device/application/handle.ts'
export {
  createDeviceManager,
  type DeviceManager
} from '@device/application/manager.ts'
export { pairRecordSecretKey } from '@device/application/pair-records.ts'
export type {
  AppFileStatus,
  AppFileTarget,
  DeveloperModeState,
  DeviceCheck,
  DeviceSession,
  InstallIpaOptions,
  InstallIpaProgress,
  InstallStage,
  OpenSessionOptions,
  PairingProgress,
  PairingTarget,
  PairMethod,
  PairOptions,
  PairRecordStore,
  PlacePairingOptions,
  StartServiceOptions
} from '@device/application/types.ts'
export { realSleep } from '@device/deps.ts'
export {
  DEFAULT_DEVICE_CONFIG,
  type DeviceConfig,
  resolveDeviceConfig
} from '@device/domain/config.ts'
export {
  InstalldCode,
  LOCKDOWN_PORT,
  Service
} from '@device/domain/constants.ts'
export { parseVersion, shortUdid } from '@device/domain/device.ts'
export {
  classifyInstallError,
  type InstallFailure
} from '@device/domain/install-errors.ts'
export {
  pairingFile,
  parsePairRecord,
  serializePairRecord,
  tlsCredentials
} from '@device/domain/pairing/pair-record.ts'
export { decodePem, encodePem } from '@device/domain/pairing/pem.ts'
export type { PairRecord } from '@device/domain/pairing/types.ts'
export {
  findPairingApps,
  matchesBundleId,
  PAIRING_APPS
} from '@device/domain/pairing-apps.ts'
export type {
  Connection,
  DeviceTransport,
  TlsCredentials
} from '@device/domain/ports/types.ts'
export {
  bundleIdOf,
  staleProfiles,
  summarizeProfile
} from '@device/domain/profiles.ts'
export type {
  ConnectionType,
  DeviceEvent,
  DeviceInfo,
  DeviceProfile,
  FindPairingAppsOptions,
  PairingApp,
  PairingAppMatch,
  RemoveStaleOptions,
  UsbmuxDevice
} from '@device/domain/types.ts'
export type { AfcClient, AfcStat } from '@device/infrastructure/afc/types.ts'
export type { ContainerMode } from '@device/infrastructure/house-arrest/client.ts'
export type { InstalledApp } from '@device/infrastructure/installation-proxy/apps.ts'
export type {
  ApplicationType,
  InstallProgress
} from '@device/infrastructure/installation-proxy/types.ts'
export { createPairRecord } from '@device/infrastructure/pairing/certificates.ts'
export type { DeviceDeps, DeviceDepsInput, Sleep } from '@device/types.ts'
