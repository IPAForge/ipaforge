// Every Apple-facing value Loadstar uses, as data. Apple changes what it accepts (client identities were blocked
// twice in 2026), so none of this is hard-coded in logic: defaults ship here, and the app can override them from a
// remote config without a release.

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

export const DEFAULT_APPLE_CONFIG: AppleConfig = {
  endpoints: {
    gsaService: 'https://gsa.apple.com/grandslam/GsService2',
    gsaLookup: 'https://gsa.apple.com/grandslam/GsService2/lookup',
    authStatus: 'https://gsa.apple.com/auth',
    trustedDevice: 'https://gsa.apple.com/auth/verify/trusteddevice',
    validateCode: 'https://gsa.apple.com/grandslam/GsService2/validate',
    phoneVerify: 'https://gsa.apple.com/auth/verify/phone',
    phoneSecurityCode: 'https://gsa.apple.com/auth/verify/phone/securitycode',
    legacyDeviceSecurityCode:
      'https://gsa.apple.com/auth/verify/device/{deviceId}/securitycode'
  },
  defaultIdentity: {
    clientInfo:
      '<MacBookPro13,2> <macOS;13.1;22C65> <com.apple.AuthKit/1 (com.apple.akd/1.0)>',
    userAgent: 'akd/1.0 CFNetwork/1404.0.5 Darwin/22.3.0'
  },
  urlBagClientInfo:
    '<Mac15,7> <macOS;27.0;26A5378j> <com.apple.AuthKit/1 (com.apple.akd/1.0)>',
  cpdAnisetteHeaders: ['X-Mme-Device-Id', 'X-Apple-I-MD', 'X-Apple-I-MD-M'],
  xcode: {
    appInfo: 'com.apple.gs.xcode.auth',
    xcodeVersion: '27.0 (27A5218g)'
  },
  anisetteServerListUrl: 'https://servers.sidestore.io/servers.json',
  anisetteServerListMaxAgeMs: 60 * 60 * 1000,
  anisetteServerListRetryMs: 60 * 1000,
  // Mac-backed servers first, then Windows-backed ones; older Android-backed servers come only from the remote list.
  fallbackAnisetteServers: [
    { name: 'jkcoxson', address: 'https://mac-ani.jkcoxson.com' },
    { name: 'StikStore', address: 'https://ani3.stikstore.app' },
    { name: 'jkcoxson (Windows)', address: 'https://ani.jkcoxson.com' },
    { name: 'StikStore (Windows)', address: 'https://ani2.stikstore.app' }
  ],
  timeouts: { requestMs: 20_000, provisioningMs: 60_000, healthCheckMs: 5_000 },
  maxClockSkewMs: 2 * 60 * 1000,
  retryAttempts: 4,
  locale: 'en_US'
}

export type AppleConfigOverrides = {
  readonly [K in keyof AppleConfig]?: AppleConfig[K] extends readonly unknown[]
    ? AppleConfig[K]
    : AppleConfig[K] extends object
      ? Partial<AppleConfig[K]>
      : AppleConfig[K]
}

export const resolveAppleConfig = (
  overrides: AppleConfigOverrides = {}
): AppleConfig => ({
  ...DEFAULT_APPLE_CONFIG,
  ...overrides,
  endpoints: { ...DEFAULT_APPLE_CONFIG.endpoints, ...overrides.endpoints },
  defaultIdentity: {
    ...DEFAULT_APPLE_CONFIG.defaultIdentity,
    ...overrides.defaultIdentity
  },
  xcode: { ...DEFAULT_APPLE_CONFIG.xcode, ...overrides.xcode },
  timeouts: { ...DEFAULT_APPLE_CONFIG.timeouts, ...overrides.timeouts }
})
