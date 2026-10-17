import type { ResolvedRelease } from '@catalog/domain/release.ts'
import type { ReleaseLocation } from '@catalog/domain/types.ts'
import type { FileSource } from '@loadstar/kernel'

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

export type Origin = ResolvedRelease['from']

export type Source = {
  readonly location: ReleaseLocation
  readonly from: Origin
}

/** Why a source produced no release (kept for the final error). */
export type Skip = {
  readonly source: string
  readonly reason: 'gone' | 'no-asset' | 'no-checksum'
}

export type Attempt =
  | { readonly release: ResolvedRelease }
  | { readonly skip: Skip }
