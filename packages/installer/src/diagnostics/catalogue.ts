// Every ErrorCode and what the user can do about it, first choice first (docs/design/failure-catalogue.md). The
// `satisfies` clause makes a new ErrorCode without an entry a type error.
import { RecoveryAction as R } from "@installer/diagnostics/recovery.ts";
import type { ErrorCode } from "@loadstar/kernel";

const REPORT = [R.Retry, R.ReportIssue] as const;
const DEVICE_LINK = [R.ReconnectDevice, R.Retry] as const;

export const RECOVERY_CATALOGUE = {
  // device
  "device.locked": [R.UnlockDevice, R.Retry],
  "device.developer_mode_off": [R.EnableDeveloperMode, R.Retry],
  "device.not_paired": [R.TrustComputer, R.Retry],
  "device.usbmuxd_unavailable": [R.InstallDeviceSupport, R.Retry],
  "device.not_found": DEVICE_LINK,
  "device.disconnected": DEVICE_LINK,
  "device.pairing_pending": [R.TrustComputer, R.Retry],
  "device.pairing_denied": [R.PairAgain, R.TrustComputer],
  "device.invalid_pair_record": [R.PairAgain, R.Retry],
  "device.service_unavailable": [R.UnlockDevice, R.ReconnectDevice, R.Retry],
  "device.protocol_error": [R.ReconnectDevice, R.UpdateLoadstar, R.ReportIssue],
  "device.install_failed": [R.Retry, R.ReinstallApp, R.ReportIssue],
  "device.afc_error": [R.UnlockDevice, R.Retry],
  "device.timeout": [R.UnlockDevice, R.ReconnectDevice, R.Retry],
  "device.passcode_required": [R.SetPasscode, R.Retry],
  "device.free_app_limit": [R.ChooseAppToRemove, R.Retry],
  // Apple blocked this Apple ID's team on the device; retrying with it only burns App IDs and certificates.
  "device.profile_banned": [R.SwitchAccount],
  "device.identity_invalid": [R.CheckClock, R.RevokeCertificate, R.SwitchAccount],
  "device.profile_not_found": [R.Retry, R.ReinstallApp],

  // apple
  "apple.anisette_unavailable": [R.ChangeAnisetteServer, R.CheckNetwork, R.Retry],
  "apple.anisette_not_provisioned": [R.ChangeAnisetteServer, R.Retry],
  "apple.app_id_quota": [R.WaitForAppIdSlot, R.SwitchAccount],
  "apple.certificate_limit": [R.RevokeCertificate, R.SwitchAccount],
  "apple.invalid_credentials": [R.ReEnterPassword],
  "apple.account_locked": [R.SignInOnAppleDevice, R.SwitchAccount],
  "apple.account_refused": [R.WaitAndRetry, R.SignInOnAppleDevice, R.SwitchAccount],
  "apple.client_rejected": [R.ChangeAnisetteServer, R.WaitAndRetry],
  "apple.rate_limited": [R.WaitAndRetry],
  "apple.service_unavailable": [R.WaitAndRetry, R.CheckNetwork],
  "apple.two_factor_required": [R.ReEnterCode],
  "apple.two_factor_invalid_code": [R.ReEnterCode],
  "apple.two_factor_unsupported": [R.SwitchAccount],
  "apple.sms_unavailable": [R.UseTrustedDevice, R.SwitchAccount],
  "apple.clock_skew": [R.CheckClock, R.Retry],
  "apple.protocol_error": [R.UpdateLoadstar, R.ReportIssue],
  "apple.session_expired": [R.SignInAgain, R.CheckClock],
  "apple.account_not_found": [R.SignInAgain],
  "apple.not_eligible": [R.SwitchAccount],
  "apple.email_unverified": [R.VerifyEmail, R.Retry],
  "apple.team_agreement": [R.AcceptAgreement, R.ChooseTeam],
  "apple.no_teams": [R.AcceptAgreement, R.SwitchAccount],
  "apple.device_limit": [R.ChooseTeam, R.SwitchAccount],
  "apple.app_id_unavailable": [R.ChooseTeam, R.SwitchAccount],
  "apple.invalid_app_id_name": [R.UpdateLoadstar, R.ReportIssue],
  "apple.certificate_not_revocable": [R.RevokeCertificate],
  "apple.no_devices_for_profile": [R.WaitAndRetry],
  "apple.developer_request_failed": REPORT,

  // catalog
  "catalog.source_gone": [R.ChooseAnotherChannel, R.ImportIpa, R.UpdateLoadstar],
  "catalog.unavailable": [R.CheckNetwork, R.Retry],
  "catalog.download_failed": [R.CheckNetwork, R.Retry],
  "catalog.checksum_mismatch": [R.Retry, R.ChooseAnotherChannel, R.ReportIssue],
  "catalog.checksum_missing": [R.ChooseAnotherChannel, R.ImportIpa],
  "catalog.rate_limited": [R.WaitAndRetry],

  "plist.invalid": [R.ChooseAnotherIpa, R.ReportIssue],
  "net.offline": [R.CheckNetwork, R.Retry],

  // signer: almost all are about the IPA itself
  "signer.invalid_macho": [R.ChooseAnotherIpa],
  "signer.encrypted_binary": [R.ChooseAnotherIpa],
  "signer.unsupported_arch": [R.ChooseAnotherIpa],
  "signer.no_header_space": [R.ChooseAnotherIpa, R.ReportIssue],
  "signer.zip_slip": [R.ChooseAnotherIpa],
  "signer.invalid_certificate": [R.RevokeCertificate, R.Retry],
  "signer.unknown_issuer": [R.UpdateLoadstar, R.CheckNetwork],
  "signer.invalid_bundle": [R.ChooseAnotherIpa],
  "signer.invalid_profile": REPORT,
  "signer.extension_prefix": [R.ChooseAnotherIpa],
  "signer.profile_mismatch": REPORT,
  "signer.profile_expired": [R.CheckClock, R.Retry],
  "signer.cert_not_in_profile": [R.Retry],
  "signer.device_not_provisioned": [R.Retry],

  // installer
  "installer.step_failed": REPORT,
  "installer.prompt_cancelled": [R.Retry],
  "installer.certificate_machine_id_missing": [R.RevokeCertificate, R.Retry],
  "installer.team_required": [R.ChooseTeam],

  "internal.aborted": [R.Retry],
  "internal.unexpected": REPORT,
} as const satisfies Readonly<Record<ErrorCode, readonly R[]>>;
