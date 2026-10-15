// Downloading a resolved release: refuse what cannot be verified, stream it into the download store while hashing,
// and keep it only when the length and SHA-256 match. The store never holds an unverified file.

import { sha256 } from '@noble/hashes/sha2.js'

import type { CatalogDeps } from '@catalog/deps.ts'
import type { ResolvedRelease } from '@catalog/domain/release.ts'
import {
  compact,
  ErrorCode,
  type FileSource,
  LoadstarError,
  toHex
} from '@loadstar/kernel'

export type DownloadProgress = {
  readonly received: number
  readonly total?: number
}

export type DownloadOptions = {
  readonly onProgress?: (progress: DownloadProgress) => void
  readonly signal?: AbortSignal
}

export type DownloadResult = {
  readonly file: FileSource
  /** SHA-256 of the file, equal to the release's expected checksum. */
  readonly sha256: string
  /** True when it came from the download cache. */
  readonly cached: boolean
}

const cacheKey = (release: ResolvedRelease): string =>
  [
    release.appId,
    release.channel,
    release.version,
    release.sha256,
    release.fileName
  ].join('/')

const SHA256_HEX = /^[0-9a-f]{64}$/

const assertDownloadable = (
  deps: CatalogDeps,
  release: ResolvedRelease
): void => {
  // Releases cross the IPC boundary, so the type alone does not guarantee a checksum.
  if (!SHA256_HEX.test(release.sha256)) {
    throw new LoadstarError(ErrorCode.ChecksumMissing, {
      message: 'release has no valid checksum',
      data: { appId: release.appId }
    })
  }
  if (!release.url.startsWith('https://')) {
    throw new LoadstarError(ErrorCode.DownloadFailed, {
      message: 'release URL is not HTTPS',
      data: { appId: release.appId }
    })
  }
  if (
    release.size !== undefined &&
    release.size > deps.config.maxDownloadBytes
  ) {
    throw new LoadstarError(ErrorCode.DownloadFailed, {
      message: 'file is larger than allowed',
      data: { size: release.size }
    })
  }
}

const requestBody = async (
  deps: CatalogDeps,
  release: ResolvedRelease,
  signal?: AbortSignal
): Promise<ReadableStream<Uint8Array>> => {
  const response = await deps.http.request(
    compact({
      method: 'GET' as const,
      url: release.url,
      headers: { 'User-Agent': 'Loadstar', Accept: 'application/octet-stream' },
      signal
    })
  )
  if (response.status === 200) return response.body
  await response.body.cancel().catch(() => {})
  throw new LoadstarError(
    response.status === 404
      ? ErrorCode.ReleaseSourceGone
      : ErrorCode.DownloadFailed,
    {
      message: `download answered HTTP ${response.status}`,
      data: { status: response.status, host: new URL(release.url).host }
    }
  )
}

/** Passes bytes through while counting and hashing them, and checks the result at the end. */
const verifier = (
  deps: CatalogDeps,
  release: ResolvedRelease,
  onProgress?: (progress: DownloadProgress) => void
) => {
  const hash = sha256.create()
  let received = 0
  const stream = new TransformStream<Uint8Array, Uint8Array>({
    transform: (chunk, controller) => {
      received += chunk.byteLength
      if (received > deps.config.maxDownloadBytes)
        throw new Error('download exceeds the size limit')
      hash.update(chunk)
      onProgress?.(compact({ received, total: release.size }))
      controller.enqueue(chunk)
    }
  })
  const verify = async (): Promise<void> => {
    if (release.size !== undefined && received !== release.size) {
      throw new LoadstarError(ErrorCode.DownloadFailed, {
        message: `incomplete download: ${received} of ${release.size} bytes`,
        data: { received, total: release.size }
      })
    }
    if (toHex(hash.digest()) !== release.sha256) {
      throw new LoadstarError(ErrorCode.ChecksumMismatch, {
        message: 'the downloaded file does not match its published checksum',
        data: { appId: release.appId, version: release.version }
      })
    }
  }

  return { stream, verify, received: () => received }
}

export const downloadRelease = async (
  deps: CatalogDeps,
  release: ResolvedRelease,
  options: DownloadOptions = {}
): Promise<DownloadResult> => {
  const key = cacheKey(release)
  const cached = await deps.store.get(key)
  if (cached) return { file: cached, sha256: release.sha256, cached: true }

  assertDownloadable(deps, release)
  const body = await requestBody(deps, release, options.signal)
  const check = verifier(deps, release, options.onProgress)
  const file = await deps.store.put(
    key,
    body.pipeThrough(check.stream),
    check.verify
  )
  deps.logger.info('downloaded', {
    appId: release.appId,
    version: release.version,
    bytes: check.received(),
    from: release.from
  })
  return { file, sha256: release.sha256, cached: false }
}
