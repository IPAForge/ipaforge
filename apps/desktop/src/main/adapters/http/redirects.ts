import { ErrorCode, IPAForgeError } from '@ipaforge/kernel'

export const MAX_REDIRECTS = 5

/** Headers that identify the user or this machine; never forwarded to another host on redirect. */
const SENSITIVE_HEADER =
  /^(authorization|cookie|security-code|x-apple-identity-token|x-apple-gs-token|x-apple-i-.*|x-mme-.*)$/i

const withoutSensitiveHeaders = (
  headers: Readonly<Record<string, string>>
): Record<string, string> =>
  Object.fromEntries(
    Object.entries(headers).filter(([name]) => !SENSITIVE_HEADER.test(name))
  )

/** True when the response asks to go elsewhere and the redirect budget allows it. */
export const shouldFollow = (
  status: number,
  location: string | undefined,
  redirects: number
): location is string =>
  status >= 300 &&
  status < 400 &&
  location !== undefined &&
  location !== '' &&
  redirects < MAX_REDIRECTS

/**
 * Follows a redirect only if it is safe: never from HTTPS down to HTTP, and when the host changes, identifying
 * headers are dropped.
 */
export const redirectTarget = (
  from: URL,
  location: string,
  headers: Readonly<Record<string, string>>
): { url: URL; headers: Record<string, string> } => {
  const url = new URL(location, from)
  if (from.protocol === 'https:' && url.protocol !== 'https:') {
    throw new IPAForgeError(ErrorCode.Offline, {
      message: `refused a redirect from HTTPS to ${url.protocol}`,
      data: { host: from.host, location: url.host }
    })
  }
  if (url.host === from.host) return { url, headers: { ...headers } }
  return { url, headers: withoutSensitiveHeaders(headers) }
}
