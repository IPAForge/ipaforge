// Public API of @ipaforge/device: talks to iPhones and iPads through the system usbmuxd, straight over Wi-Fi, and
// through the iOS 17.4+ device tunnel.

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
  DeviceTunnel,
  InstallIpaOptions,
  InstallIpaProgress,
  InstallStage,
  OpenSessionOptions,
  PairingProgress,
  PairingTarget,
  PairMethod,
  PairOptions,
  PairRecordStore,
  PlacedPairing,
  PlacePairingOptions,
  RemotePairingOptions,
  RemotePairingResult,
  RemotePairingState,
  StartServiceOptions
} from '@device/application/types.ts'
export { realSleep } from '@device/deps.ts'
export {
  DEFAULT_DEVICE_CONFIG,
  type DeviceConfig,
  resolveDeviceConfig
} from '@device/domain/config.ts'
export {
  CORE_DEVICE_PROXY_SERVICE,
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
  PAIRING_APPS,
  remotePairingTargets,
  supportsRemotePairing
} from '@device/domain/pairing-apps.ts'
export type {
  Connection,
  Datagram,
  DeviceTransport,
  MulticastSocket,
  TlsCredentials
} from '@device/domain/ports/types.ts'
export {
  bundleIdOf,
  staleProfiles,
  summarizeProfile
} from '@device/domain/profiles.ts'
export {
  remotePairingFile,
  remotePairingSecretKey
} from '@device/domain/remote-pairing/record.ts'
export type { RemotePairingRecord } from '@device/domain/remote-pairing/types.ts'
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
export {
  serializeKnownDevices,
  WIFI_DEVICES_KEY
} from '@device/domain/wifi.ts'
export type { AfcClient, AfcStat } from '@device/infrastructure/afc/types.ts'
export type { ContainerMode } from '@device/infrastructure/house-arrest/client.ts'
export type { InstalledApp } from '@device/infrastructure/installation-proxy/apps.ts'
export type {
  ApplicationType,
  InstallProgress
} from '@device/infrastructure/installation-proxy/types.ts'
export {
  MDNS_GROUP,
  MDNS_PORT
} from '@device/infrastructure/mdns/constants.ts'
export { createPairRecord } from '@device/infrastructure/pairing/certificates.ts'
export { SHIM_SUFFIX } from '@device/infrastructure/rsd/constants.ts'
export type {
  RsdService,
  XpcDictionary,
  XpcValue
} from '@device/infrastructure/rsd/types.ts'
export { XpcUuid } from '@device/infrastructure/rsd/xpc-uuid.ts'
export type { TcpStats } from '@device/infrastructure/tunnel/types.ts'
export type { DeviceDeps, DeviceDepsInput, Sleep } from '@device/types.ts'
