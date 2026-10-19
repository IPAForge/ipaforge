/**
 * Stable, namespaced error codes (`<context>.<snake_case>`).
 *
 * Codes are part of the public contract: the UI maps each one to a recovery screen and
 * translations, so never rename a code — add a new one and deprecate the old.
 */
export const ErrorCode = {
  // device
  DeviceLocked: 'device.locked',
  DeveloperModeOff: 'device.developer_mode_off',
  DeviceNotPaired: 'device.not_paired',
  UsbmuxdUnavailable: 'device.usbmuxd_unavailable',
  DeviceNotFound: 'device.not_found',
  DeviceDisconnected: 'device.disconnected',
  PairingPending: 'device.pairing_pending',
  PairingDenied: 'device.pairing_denied',
  InvalidPairRecord: 'device.invalid_pair_record',
  ServiceUnavailable: 'device.service_unavailable',
  DeviceProtocolError: 'device.protocol_error',
  InstallFailed: 'device.install_failed',
  AfcError: 'device.afc_error',
  DeviceTimeout: 'device.timeout',
  PasscodeRequired: 'device.passcode_required',
  FreeAppLimit: 'device.free_app_limit',
  ProfileBanned: 'device.profile_banned',
  SigningIdentityInvalid: 'device.identity_invalid',
  ProfileNotFound: 'device.profile_not_found',

  // apple
  AnisetteUnavailable: 'apple.anisette_unavailable',
  AnisetteNotProvisioned: 'apple.anisette_not_provisioned',
  AppIdQuotaExceeded: 'apple.app_id_quota',
  CertificateLimit: 'apple.certificate_limit',
  InvalidCredentials: 'apple.invalid_credentials',
  AccountLocked: 'apple.account_locked',
  AccountRefused: 'apple.account_refused',
  ClientRejected: 'apple.client_rejected',
  RateLimited: 'apple.rate_limited',
  AppleServiceUnavailable: 'apple.service_unavailable',
  TwoFactorRequired: 'apple.two_factor_required',
  TwoFactorInvalidCode: 'apple.two_factor_invalid_code',
  TwoFactorUnsupported: 'apple.two_factor_unsupported',
  SmsUnavailable: 'apple.sms_unavailable',
  ClockSkew: 'apple.clock_skew',
  AppleProtocolError: 'apple.protocol_error',
  SessionExpired: 'apple.session_expired',
  AccountNotFound: 'apple.account_not_found',
  NotEligibleForDevelopment: 'apple.not_eligible',
  EmailUnverified: 'apple.email_unverified',
  TeamAgreementRequired: 'apple.team_agreement',
  NoTeams: 'apple.no_teams',
  DeviceLimit: 'apple.device_limit',
  AppIdUnavailable: 'apple.app_id_unavailable',
  InvalidAppIdName: 'apple.invalid_app_id_name',
  CertificateNotRevocable: 'apple.certificate_not_revocable',
  NoDevicesForProfile: 'apple.no_devices_for_profile',
  DeveloperRequestFailed: 'apple.developer_request_failed',

  // catalog
  ReleaseSourceGone: 'catalog.source_gone',
  CatalogUnavailable: 'catalog.unavailable',
  DownloadFailed: 'catalog.download_failed',
  ChecksumMismatch: 'catalog.checksum_mismatch',
  ChecksumMissing: 'catalog.checksum_missing',
  GithubRateLimited: 'catalog.rate_limited',
  /** An app source (AltStore format) couldn't be fetched: offline, an HTTP error, or a timeout. */
  AppSourceUnreachable: 'catalog.app_source_unreachable',
  /** The link answered, but not with an app source (not JSON, too large, or no app in the AltStore format). */
  AppSourceInvalid: 'catalog.app_source_invalid',
  AppSourceExists: 'catalog.app_source_exists',

  // plist
  InvalidPlist: 'plist.invalid',

  // network
  Offline: 'net.offline',

  // signer
  InvalidMachO: 'signer.invalid_macho',
  EncryptedBinary: 'signer.encrypted_binary',
  /** The Mach-O file format itself is not one iOS uses (e.g. `fat_arch_64`). */
  UnsupportedArch: 'signer.unsupported_arch',
  /** The device's iOS is older than the app's `MinimumOSVersion`. */
  UnsupportedIos: 'signer.unsupported_ios',
  /** The app's `UIDeviceFamily` does not include this kind of device (e.g. an iPad-only app on an iPhone). */
  UnsupportedDevice: 'signer.unsupported_device',
  /** The main executable has no arm64 or arm64e slice (e.g. a 32-bit-only or simulator build). */
  NoArm64Build: 'signer.no_arm64_build',
  NoHeaderSpace: 'signer.no_header_space',
  ZipSlip: 'signer.zip_slip',
  InvalidCertificate: 'signer.invalid_certificate',
  UnknownIssuer: 'signer.unknown_issuer',
  InvalidBundle: 'signer.invalid_bundle',
  InvalidProfile: 'signer.invalid_profile',
  ExtensionPrefix: 'signer.extension_prefix',
  ProfileMismatch: 'signer.profile_mismatch',
  ProfileExpired: 'signer.profile_expired',
  CertificateNotInProfile: 'signer.cert_not_in_profile',
  DeviceNotProvisioned: 'signer.device_not_provisioned',

  // installer
  StepFailed: 'installer.step_failed',
  PromptCancelled: 'installer.prompt_cancelled',
  /** The certificate has no machineId, which is the password SideStore opens its `.p12` with. */
  CertificateMachineIdMissing: 'installer.certificate_machine_id_missing',
  /** The account has several teams and none was chosen or remembered. */
  TeamRequired: 'installer.team_required',
  /** Refresh: the app wasn't installed by IPAForge here, or its kept IPA is gone; it has to be added again. */
  KeptIpaMissing: 'installer.kept_ipa_missing',
  WrongApp: 'installer.wrong_app',

  // rpc
  /** A message between the Engine and the UI failed validation or refers to an unknown run or checkpoint. */
  InvalidRpcMessage: 'rpc.invalid_message',
  /** The connection to the Engine closed while a request or run was waiting. */
  RpcDisconnected: 'rpc.disconnected',
  /** The Engine did not answer a request in time. */
  RpcTimeout: 'rpc.timeout',

  // generic
  Aborted: 'internal.aborted',
  Unexpected: 'internal.unexpected'
} as const

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode]

const knownCodes: ReadonlySet<string> = new Set(Object.values(ErrorCode))

export const isErrorCode = (value: unknown): value is ErrorCode =>
  typeof value === 'string' && knownCodes.has(value)
