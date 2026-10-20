import type {
  AnisetteChoice,
  AnisetteOverview,
  AnisetteServerInput,
  AnisetteServerTest
} from '@apple/application/anisette/types.ts'
import type { AppTokenService } from '@apple/application/app-token.ts'
import type { DeveloperServices } from '@apple/application/developer.ts'
import type {
  AnisetteData,
  AnisetteServer,
  AppleSession,
  AppToken,
  SecondFactorKind,
  SecondFactorRequest,
  TwoFactorMethod,
  TwoFactorMethods
} from '@apple/domain/types.ts'
import type { AppleDeps } from '@apple/types.ts'
import type { ErrorCode } from '@ipaforge/kernel'

export type AccountHealth = {
  readonly lastSuccessAt?: string | undefined
  /** Device UDIDs where Apple rejected this ID's profiles (0xe8008024). */
  readonly bannedOnDevices: string[]
  /** Last catalogued error code, for the account switcher. */
  readonly lastError?: string | undefined
}

export type SavedAccount = {
  readonly id: string
  readonly appleId: string
  readonly displayName?: string | undefined
  /** The team chosen for this account (Phase 4 team picker). */
  readonly teamId?: string | undefined
  readonly health: AccountHealth
}

export type SaveOptions = {
  /** Keep the password (in the OS-backed secret store) so the session can be renewed without asking. */
  readonly rememberPassword?: string
}

export type AccountStore = {
  list(): Promise<SavedAccount[]>
  active(): Promise<SavedAccount | undefined>
  save(session: AppleSession, options?: SaveOptions): Promise<SavedAccount>
  switchTo(id: string): Promise<SavedAccount>
  /** Forgets the account, its session and its password. Removing an unknown account is not an error. */
  remove(id: string): Promise<void>
  session(id: string): Promise<AppleSession | undefined>
  password(id: string): Promise<string | undefined>
  update(
    id: string,
    patch: { teamId?: string; health?: Partial<AccountHealth> }
  ): Promise<SavedAccount>
  /** Accounts not banned on `udid`, most recently successful first (for one-click switching). */
  usableOn(udid: string): Promise<SavedAccount[]>
}

export type ServerHealth = {
  readonly server: AnisetteServer
  readonly ok: boolean
  readonly latencyMs?: number
  readonly error?: string
}

export type AnisetteService = {
  /** Added by the user, SideStore's list (kept up to date), then the built-in backup: deduplicated, in that order. */
  servers(): Promise<AnisetteServer[]>
  health(server: AnisetteServer): Promise<ServerHealth>
  /** Headers and client identity from the first server that works. */
  get(options?: {
    readonly preferred?: AnisetteServer
    readonly signal?: AbortSignal
  }): Promise<AnisetteData>
  /**
   * Resyncs this machine with the same server after GSA answered hsc 434, returning corrected headers.
   * `resyncData` is the base64 `X-Apple-I-MD-DATA` from that answer.
   */
  resync(data: AnisetteData, resyncData: string): Promise<AnisetteData>
  /** Forgets provisioning state (all servers when omitted). Missing state is not an error. */
  reset(server?: AnisetteServer): Promise<void>
  /** The servers, the choice, the last one that worked and SideStore's list's age, for Settings. */
  overview(): Promise<AnisetteOverview>
  /** Automatic, or always one server of the list (none yet: still automatic). */
  choose(choice: AnisetteChoice): Promise<AnisetteOverview>
  /** Adds a server, used first (and chosen, when the user picks servers). Http is allowed: the user typed it. */
  addServer(input: AnisetteServerInput): Promise<AnisetteOverview>
  updateServer(
    address: string,
    input: AnisetteServerInput
  ): Promise<AnisetteOverview>
  removeServer(address: string): Promise<AnisetteOverview>
  /** Whether a server answers, and how fast: one in the list, or an address being added. */
  test(address: string): Promise<AnisetteServerTest>
  /** Fetches SideStore's list now. */
  updateList(): Promise<AnisetteOverview>
}

export type ResumeResult =
  | SignInResult
  | { readonly kind: 'needs_password'; readonly appleId: string }
  /** Not interactive, and Apple wants a second factor: nothing was sent, the user has to sign in again. */
  | { readonly kind: 'needs_code'; readonly appleId: string }

export type ResumeOptions = {
  /**
   * False for checks nobody is waiting on (an account's status, its teams or quota): the saved session or password
   * is still used, but when Apple wants a second factor no code is sent, since there is nowhere to type it.
   * Default: true.
   */
  readonly interactive?: boolean
}

export type AppleAccounts = {
  readonly anisette: AnisetteService
  readonly accounts: AccountStore
  preflight(): Promise<PreflightReport>
  signIn(input: SignInInput): Promise<SignInResult>
  appToken(session: AppleSession, app?: string): Promise<AppToken>
  /**
   * Re-opens a saved account: reuses its session while Apple accepts it, otherwise signs in again with the
   * saved password (usually without 2FA, since this machine is already known), otherwise asks for the password.
   */
  resume(id: string, options?: ResumeOptions): Promise<ResumeResult>
  /** Developer services (teams, certificates, App IDs, profiles) for a signed-in session. */
  developer(session: AppleSession): DeveloperServices
  /** Records that Apple blocked this account's profiles on a device, so the UI can offer another account. */
  markBanned(id: string, udid: string): Promise<void>
}

export type AppleAccountsOptions = {
  /** A user-configured anisette server, tried first. */
  readonly customAnisetteServer?: AnisetteServer
}

export type ResumeServices = {
  readonly deps: AppleDeps
  readonly accounts: AccountStore
  readonly tokens: AppTokenService
  readonly signIn: SignInService
}

export type Resync = (
  data: AnisetteData,
  resyncData: string
) => Promise<AnisetteData>

export type Credentials = {
  readonly appleId: string
  readonly password: string
  readonly signal?: AbortSignal
}

export type Authenticated = {
  readonly session: AppleSession
  readonly secondFactor?: SecondFactorRequest
}

export type PreflightReport = {
  readonly apple: { readonly ok: boolean; readonly error?: string }
  /** Server clock minus local clock, when Apple answered with a `Date` header. */
  readonly clockSkewSeconds?: number
  readonly clockOk: boolean
  readonly anisette: readonly ServerHealth[]
  /** The first blocking problem, as a catalogued error code. */
  readonly problem?: ErrorCode
}

export type AppleProbe = {
  readonly ok: boolean
  readonly skewMs?: number | undefined
  readonly error?: string | undefined
}

export type SignInResult =
  | { readonly kind: 'signed_in'; readonly session: AppleSession }
  | { readonly kind: 'two_factor'; readonly challenge: TwoFactorChallenge }

export type SignInInput = {
  readonly appleId: string
  readonly password: string
  readonly signal?: AbortSignal
  /** False: when Apple asks for a second factor, don't ask it to send a code to the trusted devices. Default: true. */
  readonly sendCode?: boolean
}

export type SignInService = {
  signIn(input: SignInInput): Promise<SignInResult>
}

export type TwoFactorChallenge = {
  /** What Apple asked for first. */
  readonly requested: SecondFactorKind
  methods(): Promise<TwoFactorMethods>
  /** Sends (or re-sends) a code. "Already sent" answers count as success. */
  requestCode(method: TwoFactorMethod): Promise<void>
  /**
   * Submits the code and finishes signing in. A wrong code throws `apple.two_factor_invalid_code` and the
   * challenge stays usable, so the UI simply asks again.
   */
  submitCode(method: TwoFactorMethod, code: string): Promise<AppleSession>
}

export type BodyFormat = 'plist' | 'json'

/** What every 2FA request needs: the deps and headers with fresh one-time anisette values. */
export type TwoFactorContext = {
  readonly deps: AppleDeps
  readonly headers: (format: BodyFormat) => Promise<Record<string, string>>
}
