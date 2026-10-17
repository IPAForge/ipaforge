import type { AnisetteData } from '@apple/domain/types.ts'
import type { AppleDeps } from '@apple/types.ts'
// Header building shared by every request made to Apple on this client's behalf.

export const PLIST_CONTENT_TYPE = 'text/x-xml-plist'
export const JSON_CONTENT_TYPE = 'application/json'

/** `Content-Type` and `Accept` for an XML-plist exchange. */
export const PLIST_HEADERS: Readonly<Record<string, string>> = {
  'Content-Type': PLIST_CONTENT_TYPE,
  Accept: PLIST_CONTENT_TYPE
}

/** Base headers for every Apple request made on behalf of this client. */
export const appleHeaders = (
  deps: AppleDeps,
  anisette: AnisetteData
): Record<string, string> => ({
  'User-Agent': anisette.identity.userAgent,
  'X-Mme-Client-Info': anisette.identity.clientInfo,
  'X-Xcode-Version': deps.config.xcode.xcodeVersion,
  'X-Apple-App-Info': deps.config.xcode.appInfo
})

/** The `names` present in `headers`, in the order of `names`. */
export const pickHeaders = (
  headers: Readonly<Record<string, string>>,
  names: readonly string[]
): Record<string, string> => {
  const picked: Record<string, string> = {}
  for (const name of names) {
    const value = headers[name]
    if (value !== undefined) picked[name] = value
  }
  return picked
}
