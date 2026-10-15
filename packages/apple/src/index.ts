// Public API of @loadstar/apple: Apple ID sign-in (SRP + 2FA), anisette with failover, app tokens, saved accounts.
export type { AccountHealth, AccountStore, SavedAccount, SaveOptions } from "@apple/application/accounts.ts";
export type { AnisetteService, ServerHealth } from "@apple/application/anisette.ts";
export { XCODE_APP } from "@apple/application/app-token.ts";
export {
  type AppleAccounts,
  type AppleAccountsOptions,
  createAppleAccounts,
  type ResumeResult,
} from "@apple/application/apple-accounts.ts";
export { assertPreflight, type PreflightReport } from "@apple/application/preflight.ts";
export type { SignInInput, SignInResult } from "@apple/application/sign-in.ts";
export type {
  TrustedPhone,
  TwoFactorChallenge,
  TwoFactorMethod,
  TwoFactorMethods,
} from "@apple/application/two-factor.ts";
export { type AppleDeps, type AppleDepsInput, resolveAppleDeps } from "@apple/deps.ts";
export { type AnisetteData, validateServerUrl } from "@apple/domain/anisette.ts";
export {
  type AnisetteServer,
  type AppleConfig,
  type AppleConfigOverrides,
  type ClientIdentity,
  DEFAULT_APPLE_CONFIG,
  resolveAppleConfig,
} from "@apple/domain/config.ts";
export { GsaCode, gsaErrorCode } from "@apple/domain/gsa-status.ts";
export type { WebSocketFactory, WebSocketLike } from "@apple/domain/ports/web-socket.ts";
export { type AppleSession, type AppToken, normalizeAppleId } from "@apple/domain/session.ts";
