import type { PlistDict } from '@ipaforge/kernel'

export type AppleEndpoints = {
  /** GrandSlam: SRP sign-in and app tokens. */
  readonly gsaService: string
  /** URL bag with the provisioning endpoints (`midStartProvisioning`, `midFinishProvisioning`). */
  readonly gsaLookup: string
  /** JSON view of the 2FA state (trusted phone numbers, code length). */
  readonly authStatus: string
  /** Triggers a push to trusted devices. */
  readonly trustedDevice: string
  /** Validates a trusted-device code (`security-code` header). */
  readonly validateCode: string
  /** Requests an SMS (`PUT`). */
  readonly phoneVerify: string
  /** Submits an SMS code (`POST`). */
  readonly phoneSecurityCode: string
  /** Legacy (`hsa`) accounts: `{deviceId}` is replaced with the trusted device's id. */
  readonly legacyDeviceSecurityCode: string
}

export type ClientIdentity = {
  /** `X-Mme-Client-Info`. */
  readonly clientInfo: string
  readonly userAgent: string
}

export type AnisetteServer = {
  readonly name: string
  /** Base URL, e.g. `https://ani.example.com`. */
  readonly address: string
  /** `v3` (provisioning + get_headers) or `v1` (headers from `GET /`). Default v3. */
  readonly protocol?: 'v1' | 'v3'
}

/** Static headers Apple's 2FA and developer endpoints expect from an Xcode-like client. */
export type XcodeHeaders = {
  readonly appInfo: string
  readonly xcodeVersion: string
}

export type AppleTimeouts = {
  readonly requestMs: number
  readonly provisioningMs: number
  readonly healthCheckMs: number
}

export type AppleConfig = {
  readonly endpoints: AppleEndpoints
  /** Client info sent only when fetching the URL bag (another identity can yield a different bag). */
  readonly urlBagClientInfo: string
  /** Anisette headers copied into GrandSlam's client-provided data (`cpd`); others go nowhere. */
  readonly cpdAnisetteHeaders: readonly string[]
  /** Used when the anisette server does not provide a client identity. */
  readonly defaultIdentity: ClientIdentity
  readonly xcode: XcodeHeaders
  /** Remote, community-maintained anisette server list (`{ servers: [{ name, address }] }`). */
  readonly anisetteServerListUrl: string
  /** How long a fetched list is used before it is fetched again (on the next anisette request, never polled). */
  readonly anisetteServerListMaxAgeMs: number
  /** After a failed fetch, how long the last known list is used before trying again. */
  readonly anisetteServerListRetryMs: number
  /** Used when the remote list cannot be fetched. Order = preference. */
  readonly fallbackAnisetteServers: readonly AnisetteServer[]
  readonly timeouts: AppleTimeouts
  /** Warn when the computer's clock differs from Apple's by more than this. */
  readonly maxClockSkewMs: number
  /** Attempts for transient failures (429/503/timeouts); wrong passwords are never retried. */
  readonly retryAttempts: number
  readonly locale: string
}

export type AppleConfigOverrides = {
  readonly [K in keyof AppleConfig]?: AppleConfig[K] extends readonly unknown[]
    ? AppleConfig[K]
    : AppleConfig[K] extends object
      ? Partial<AppleConfig[K]>
      : AppleConfig[K]
}

export type Team = {
  readonly id: string
  readonly name: string
  /** e.g. "Individual", "Company/Organization" (as Apple reports it). */
  readonly type?: string
  readonly status?: string
  /** Free (personal) team: 7-day profiles, App ID quota. */
  readonly isFree: boolean
}

export type RegisteredDevice = {
  readonly id?: string
  readonly udid: string
  readonly name?: string
  readonly status?: string
}

export type DevelopmentCertificate = {
  readonly id?: string
  readonly serialNumber: string
  readonly name?: string
  /** Which computer/tool created it (IPAForge, Xcode, SideStore, …): shown in the revoke picker. */
  readonly machineName?: string
  readonly machineId?: string
  /** DER. */
  readonly content?: Uint8Array
  readonly platform?: string
  readonly status?: string
  readonly expiresAt?: Date
}

export type AppId = {
  readonly id: string
  /** Bundle identifier, e.g. `com.SideStore.SideStore.ABCDE12345`. */
  readonly identifier: string
  readonly name: string
  readonly features: PlistDict
  /** Free accounts: when this App ID stops counting against the quota. */
  readonly expiresAt?: Date
}

export type AppIdQuota = {
  readonly max?: number
  /** Never negative (Apple sometimes reports negative numbers). */
  readonly available: number
  /** Apple reported a negative number left: its count can't be trusted (it may still create App IDs). */
  readonly isUnreliable?: boolean
}

export type AppGroup = {
  /** Apple's id (`applicationGroup`). */
  readonly id: string
  readonly identifier: string
  readonly name?: string
}

export type ProvisioningProfile = {
  readonly id: string
  readonly uuid: string
  readonly name: string
  /** The signed `.mobileprovision` bytes. */
  readonly data: Uint8Array
  readonly expiresAt: Date
  readonly appIdId: string
}

export type AppIdPlan = {
  /** Identifiers that already exist on the team (reused, no quota). */
  readonly reuse: readonly AppId[]
  /** Identifiers that must be created. */
  readonly create: readonly string[]
  readonly available: number
  readonly enough: boolean
  /** When the earliest existing App ID expires (frees a slot), if known. */
  readonly nextSlotAt?: Date
  /** Apple's count was negative, so "not enough" may be wrong. */
  readonly isUnreliable?: boolean
}

/** A signed-in Apple ID. Secret: whoever holds it can act as the user towards Apple. */
export type AppleSession = {
  /** Normalised Apple ID (email lowercased, or phone number). */
  readonly appleId: string
  /** Apple's account identifier (`adsid`). */
  readonly adsid: string
  /** `GsIdmsToken`: identifies the session in 2FA and app-token requests. */
  readonly idmsToken: string
  /** Session key for app-token requests (`sk`). */
  readonly sessionKey: Uint8Array
  /** Cookie for app-token requests (`c`). */
  readonly cookie: Uint8Array
  readonly firstName?: string
  readonly lastName?: string
  /** The anisette server the session was created with (Apple ties the session to that machine identity). */
  readonly anisetteServer: string
}

export type AppToken = {
  readonly app: string
  readonly token: string
  readonly expiresAt: Date
}

/** Second factor requested by GSA (`Status.au`). */
export type SecondFactorKind = 'trusted_device' | 'sms'

/** GSA `Status.au` values IPAForge knows how to handle. */
export type SecondFactorAu =
  | 'trustedDeviceSecondaryAuth'
  | 'secondaryAuth'
  | 'repair'

export type SecondFactorRequest = {
  readonly kind: SecondFactorKind
  /** Apple already pushed a code to the trusted devices; go straight to code entry. */
  readonly codeAlreadySent: boolean
}

export type TrustedPhone = {
  readonly id: number
  /** As Apple shows it, e.g. "+40 ••• ••• •12". */
  readonly number: string
}

export type TwoFactorMethods = {
  readonly trustedDevice: boolean
  readonly phones: readonly TrustedPhone[]
  /** Digits Apple expects (6 for current accounts, 4 for legacy ones). */
  readonly codeLength: number
  /** Legacy two-step (`hsa`) account: codes go to a trusted device id. */
  readonly legacy: boolean
  /** The account only has security keys, which IPAForge cannot use. */
  readonly securityKeysOnly: boolean
}

export type TwoFactorMethod =
  | { readonly type: 'trusted_device' }
  | { readonly type: 'sms'; readonly phoneId: number }
  | { readonly type: 'legacy_device'; readonly deviceId: string }

/** What Apple's JSON 2FA state says, before it is turned into `TwoFactorMethods`. */
export type AuthStatus = {
  readonly legacy: boolean
  readonly phones: readonly TrustedPhone[]
  readonly codeLength?: number
  /** Security keys are registered (or a security-key challenge is pending). */
  readonly hasSecurityKeys: boolean
}

/** What Apple needs to recognise this computer as a known machine. */
export type AnisetteData = {
  /** `X-Apple-I-MD*`, `X-Mme-Device-Id`, `X-Apple-I-SRL-NO` and the time/locale headers. */
  readonly headers: Readonly<Record<string, string>>
  readonly identity: ClientIdentity
  /** Which server produced it (for health tracking and error messages). */
  readonly server: string
  /** That server's base URL (a resync must go back to the same server). */
  readonly serverAddress: string
}

/** Per-server provisioning state. Secret: it identifies this machine to Apple. */
export type AnisetteState = {
  /** 16 random bytes, generated once per server. */
  readonly identifier: Uint8Array
  /** Provisioning blob returned by a v3 server after the Apple handshake. */
  readonly adiPb?: Uint8Array
}
