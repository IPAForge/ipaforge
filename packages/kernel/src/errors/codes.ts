/**
 * Stable, namespaced error codes (`<context>.<snake_case>`).
 *
 * Codes are part of the public contract: the UI maps each one to a recovery screen and
 * translations, so never rename a code — add a new one and deprecate the old.
 */
export const ErrorCode = {
  // device
  DeviceLocked: "device.locked",
  DeveloperModeOff: "device.developer_mode_off",
  DeviceNotPaired: "device.not_paired",
  UsbmuxdUnavailable: "device.usbmuxd_unavailable",
  DeviceNotFound: "device.not_found",
  DeviceDisconnected: "device.disconnected",
  PairingPending: "device.pairing_pending",
  PairingDenied: "device.pairing_denied",
  InvalidPairRecord: "device.invalid_pair_record",
  ServiceUnavailable: "device.service_unavailable",
  DeviceProtocolError: "device.protocol_error",
  InstallFailed: "device.install_failed",
  AfcError: "device.afc_error",
  DeviceTimeout: "device.timeout",
  PasscodeRequired: "device.passcode_required",
  FreeAppLimit: "device.free_app_limit",
  ProfileBanned: "device.profile_banned",
  SigningIdentityInvalid: "device.identity_invalid",
  ProfileNotFound: "device.profile_not_found",

  // apple
  AnisetteUnavailable: "apple.anisette_unavailable",
  AppIdQuotaExceeded: "apple.app_id_quota",
  CertificateLimit: "apple.certificate_limit",

  // catalog
  ReleaseSourceGone: "catalog.source_gone",

  // plist
  InvalidPlist: "plist.invalid",

  // network
  Offline: "net.offline",

  // signer
  InvalidMachO: "signer.invalid_macho",
  EncryptedBinary: "signer.encrypted_binary",
  UnsupportedArch: "signer.unsupported_arch",
  NoHeaderSpace: "signer.no_header_space",
  ZipSlip: "signer.zip_slip",
  InvalidCertificate: "signer.invalid_certificate",
  UnknownIssuer: "signer.unknown_issuer",
  InvalidBundle: "signer.invalid_bundle",
  InvalidProfile: "signer.invalid_profile",
  ExtensionPrefix: "signer.extension_prefix",
  ProfileMismatch: "signer.profile_mismatch",
  ProfileExpired: "signer.profile_expired",
  CertificateNotInProfile: "signer.cert_not_in_profile",
  DeviceNotProvisioned: "signer.device_not_provisioned",

  // generic
  Aborted: "internal.aborted",
  Unexpected: "internal.unexpected",
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

const knownCodes: ReadonlySet<string> = new Set(Object.values(ErrorCode));

export const isErrorCode = (value: unknown): value is ErrorCode => typeof value === "string" && knownCodes.has(value);
