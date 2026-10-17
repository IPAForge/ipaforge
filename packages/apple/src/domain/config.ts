// Every Apple-facing value Loadstar uses, as data. Apple changes what it accepts (client identities were blocked
// twice in 2026), so none of this is hard-coded in logic: defaults ship here, and the app can override them from a
// remote config without a release.
import type { AppleConfig, AppleConfigOverrides } from '@apple/domain/types.ts'

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
    { name: 'StikStore', address: 'https://ani3.stikstore.app' },
    { name: 'jkcoxson', address: 'https://mac-ani.jkcoxson.com' },
    { name: 'jkcoxson (Windows)', address: 'https://ani.jkcoxson.com' },
    { name: 'StikStore (Windows)', address: 'https://ani2.stikstore.app' }
  ],
  timeouts: { requestMs: 20_000, provisioningMs: 60_000, healthCheckMs: 5_000 },
  maxClockSkewMs: 2 * 60 * 1000,
  retryAttempts: 4,
  locale: 'en_US'
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
