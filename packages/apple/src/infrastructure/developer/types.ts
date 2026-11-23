import type { AnisetteData, DevicePlatform } from '@apple/domain/types.ts'
import type { PlistValue } from '@ipaforge/kernel'

/** `ios/` or `tvos/` resources (devices, certificates, App IDs, …), or team-level actions (`listTeams`). */
export type DeveloperPlatform = DevicePlatform | 'any'

/** Request fields, in the order they are sent. */
export type DeveloperFields = readonly (readonly [string, PlistValue])[]

export type DeveloperAuth = {
  /** `com.apple.gs.xcode.auth` app token. */
  readonly token: string
  readonly adsid: string
}

export type DeveloperRequestOptions = {
  readonly anisette: () => Promise<AnisetteData>
  readonly auth: () => Promise<DeveloperAuth>
}
