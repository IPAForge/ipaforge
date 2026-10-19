// Reading an app source over the network: https only, a size limit, and errors that say whether the link couldn't
// be reached or didn't hold a source.
import { readAltStoreSource } from '@catalog/domain/altstore.ts'
import type { SourceContent } from '@catalog/domain/types.ts'
import type { CatalogDeps } from '@catalog/types.ts'
import {
  ErrorCode,
  IPAForgeError,
  readBody,
  utf8Decode
} from '@ipaforge/kernel'

const HTTP_OK = 200

const invalid = (url: string, message: string, cause?: unknown) =>
  new IPAForgeError(ErrorCode.AppSourceInvalid, {
    message,
    data: { url },
    ...(cause === undefined ? {} : { cause })
  })

const unreachable = (url: string, message: string, cause?: unknown) =>
  new IPAForgeError(ErrorCode.AppSourceUnreachable, {
    message,
    data: { url },
    ...(cause === undefined ? {} : { cause })
  })

/** The link as it's saved and compared: https only, without surrounding spaces or a fragment. */
export const normaliseSourceUrl = (url: string): string => {
  let parsed: URL

  try {
    parsed = new URL(url.trim())
  } catch (error) {
    throw invalid(url, 'not a link', error)
  }
  if (parsed.protocol !== 'https:') throw invalid(url, 'not an https link')
  parsed.hash = ''

  return parsed.href
}

const isSourceError = (error: unknown) =>
  error instanceof IPAForgeError &&
  (error.code === ErrorCode.AppSourceInvalid ||
    error.code === ErrorCode.AppSourceUnreachable)

const download = async (
  deps: CatalogDeps,
  url: string,
  signal?: AbortSignal
): Promise<Uint8Array> => {
  const timeout = AbortSignal.timeout(deps.config.requestTimeoutMs)

  try {
    const response = await deps.http.request({
      method: 'GET',
      url,
      headers: { Accept: 'application/json', 'User-Agent': 'IPAForge' },
      signal: signal ? AbortSignal.any([signal, timeout]) : timeout
    })

    if (response.status !== HTTP_OK) {
      await response.body.cancel()
      throw unreachable(url, `HTTP ${response.status}`)
    }
    return await readBody(response, deps.config.maxSourceBytes)
  } catch (error) {
    if (isSourceError(error)) throw error
    if (error instanceof RangeError) throw invalid(url, 'too large', error)
    throw unreachable(url, 'request failed', error)
  }
}

const parseJson = (url: string, body: Uint8Array): unknown => {
  try {
    return JSON.parse(utf8Decode(body))
  } catch (error) {
    throw invalid(url, 'not JSON', error)
  }
}

/** Downloads and reads an app source; throws `catalog.app_source_*` when it can't. */
export const fetchSource = async (
  deps: CatalogDeps,
  url: string,
  signal?: AbortSignal
): Promise<SourceContent> => {
  const content = readAltStoreSource(
    parseJson(url, await download(deps, url, signal))
  )

  if (!content) throw invalid(url, 'not an app source')
  deps.logger.info('app source read', {
    url,
    apps: content.apps.length,
    skipped: content.skipped
  })

  return content
}
