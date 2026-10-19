// Public API of @ipaforge/apple: Apple ID sign-in (SRP + 2FA), anisette with failover, app tokens, saved accounts.
export { XCODE_APP } from '@apple/application/app-token.ts'
export { createAppleAccounts } from '@apple/application/apple-accounts.ts'
export type {
  BundleRequest,
  CertificateIdentity,
  DeveloperServices,
  EnsureCertificateOptions,
  ProvisionProgress,
  ProvisionRequest,
  ProvisionResult,
  ProvisionTask
} from '@apple/application/developer.ts'
export { assertPreflight } from '@apple/application/preflight.ts'
export type {
  TrustedPhone,
  TwoFactorMethod,
  TwoFactorMethods
} from '@apple/application/two-factor.ts'
export type {
  AccountHealth,
  AccountStore,
  AnisetteService,
  AppleAccounts,
  AppleAccountsOptions,
  PreflightReport,
  ResumeResult,
  SavedAccount,
  SaveOptions,
  ServerHealth,
  SignInInput,
  SignInResult,
  TwoFactorChallenge
} from '@apple/application/types.ts'
export { resolveAppleDeps } from '@apple/deps.ts'
export { validateServerUrl } from '@apple/domain/anisette.ts'
export {
  DEFAULT_APPLE_CONFIG,
  resolveAppleConfig
} from '@apple/domain/config.ts'
export { DeveloperCode, GsaCode } from '@apple/domain/constants.ts'
export {
  APP_GROUPS_FEATURE,
  developerErrorCode,
  normalizeAppIdName,
  planAppIds
} from '@apple/domain/developer.ts'
export { gsaErrorCode } from '@apple/domain/gsa-status.ts'
export type {
  WebSocketFactory,
  WebSocketLike
} from '@apple/domain/ports/types.ts'
export { normalizeAppleId } from '@apple/domain/session.ts'
export type {
  AnisetteData,
  AnisetteServer,
  AppGroup,
  AppId,
  AppIdPlan,
  AppIdQuota,
  AppleConfig,
  AppleConfigOverrides,
  AppleSession,
  AppToken,
  ClientIdentity,
  DevelopmentCertificate,
  ProvisioningProfile,
  RegisteredDevice,
  Team
} from '@apple/domain/types.ts'
export type { AppleDeps, AppleDepsInput } from '@apple/types.ts'
