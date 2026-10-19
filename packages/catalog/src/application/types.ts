import type { ResolvedRelease } from '@catalog/domain/release.ts'
import type {
  ReleaseLocation,
  SourceApps,
  SourceContent,
  SourceInfo
} from '@catalog/domain/types.ts'
import type { FileSource } from '@ipaforge/kernel'

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

/** A source read but not saved: what Add source shows before the user confirms. */
export type SourcePreview = {
  /** The link as it will be saved (normalised). */
  readonly url: string
  readonly content: SourceContent
}

/** App sources: the built-in ones and those the user added, their apps, and keeping them up to date. */
export type Sources = {
  /** Every source with what was last read from it; reads nothing from the network but the catalog manifest. */
  list(signal?: AbortSignal): Promise<readonly SourceInfo[]>
  /** The apps of every AltStore-format source that's on; a copy older than `sourceTtlMs` is read again first. */
  apps(signal?: AbortSignal): Promise<readonly SourceApps[]>
  /** Reads a link as a source without saving it. */
  check(url: string, signal?: AbortSignal): Promise<SourcePreview>
  /** Reads a link as a source and saves it, on. */
  add(url: string, signal?: AbortSignal): Promise<SourceInfo>
  /** Forgets a source the user added; built-in ones can only be turned off. */
  remove(id: string): Promise<void>
  setEnabled(id: string, enabled: boolean): Promise<void>
  /** Reads one source again, or every source that's on. */
  refresh(id?: string, signal?: AbortSignal): Promise<readonly SourceInfo[]>
}
