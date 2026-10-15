// Apple's URL bag (GsService2/lookup) names the endpoints Apple wants clients to use (`gsService`,
// `trustedDeviceSecondaryAuth`, `validateCode`, `midStartProvisioning`, …). Using it instead of fixed URLs means
// an endpoint move on Apple's side needs no release. Fetched once per AppleDeps with a fixed macOS identity
// (other identities can be handed a different bag); the config URLs are the fallback.

import type { AppleDeps } from '@apple/deps.ts'
import { PLIST_CONTENT_TYPE } from '@apple/infrastructure/apple-headers.ts'
import { fetchApple } from '@apple/infrastructure/http.ts'
import { parseApplePlist } from '@apple/infrastructure/plist-diagnostics.ts'
import { ErrorCode, isPlistDict, LoadstarError } from '@loadstar/kernel'

export type UrlBag = Readonly<Record<string, string>>

const bags = new WeakMap<AppleDeps, Promise<UrlBag>>()

const fetchBag = async (deps: AppleDeps): Promise<UrlBag> => {
  const response = await fetchApple(deps, deps.config.endpoints.gsaLookup, {
    headers: {
      'User-Agent': deps.config.defaultIdentity.userAgent,
      'X-Mme-Client-Info': deps.config.urlBagClientInfo,
      Accept: PLIST_CONTENT_TYPE
    }
  })
  const value = parseApplePlist(response.body, 'URL bag')
  const urls =
    isPlistDict(value) && isPlistDict(value.urls) ? value.urls : undefined
  if (!urls)
    throw new LoadstarError(ErrorCode.AppleProtocolError, {
      message: 'URL bag has no urls'
    })
  const bag: Record<string, string> = {}
  for (const [key, url] of Object.entries(urls))
    if (typeof url === 'string') bag[key] = url
  return bag
}

export const urlBag = (deps: AppleDeps): Promise<UrlBag> => {
  let bag = bags.get(deps)
  if (!bag) {
    bag = fetchBag(deps)
    bags.set(deps, bag)
    bag.catch(() => bags.delete(deps))
  }
  return bag
}

/** The URL Apple names for `key`, or `fallback` when the bag does not have it (or cannot be fetched). */
export const bagUrl = async (
  deps: AppleDeps,
  key: string,
  fallback?: string
): Promise<string> => {
  try {
    const url = (await urlBag(deps))[key]
    if (url) return url
  } catch (error) {
    if (!fallback) throw error
    deps.logger.warn('URL bag unavailable; using the built-in endpoint', {
      key,
      cause: error
    })
  }
  if (!fallback)
    throw new LoadstarError(ErrorCode.AppleProtocolError, {
      message: `URL bag has no ${key}`
    })
  return fallback
}
