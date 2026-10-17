import type { AnisetteData } from '@apple/domain/types.ts'
import type { PlistValue } from '@loadstar/kernel'

/** `ios/` resources (devices, certificates, App IDs, …) or team-level actions (`listTeams`). */
export type DeveloperPlatform = 'ios' | 'any'

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
