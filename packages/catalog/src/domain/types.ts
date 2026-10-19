import type { z } from 'zod'

import type {
  appKinds,
  appSchema,
  githubLocationSchema,
  locationSchema,
  manifestSchema,
  releaseSchema,
  urlLocationSchema
} from '@catalog/domain/manifest.ts'

export type Manifest = z.infer<typeof manifestSchema>
export type CatalogApp = z.infer<typeof appSchema>
export type Release = z.infer<typeof releaseSchema>
export type ReleaseLocation = z.infer<typeof locationSchema>
export type GithubLocation = z.infer<typeof githubLocationSchema>
export type UrlLocation = z.infer<typeof urlLocationSchema>
export type Channel = 'stable' | 'nightly'
export type AppKind = (typeof appKinds)[number]

/** One installable version of an app in an app source. */
export type SourceAppVersion = {
  readonly version: string
  /** As the source wrote it (ISO 8601, sometimes loosely); shown, never computed with. */
  readonly date?: string
  /** https, and the path ends in `.ipa`. */
  readonly downloadUrl: string
  readonly size?: number
  readonly minOsVersion?: string
}

/** An app as an app source (AltStore format) lists it; its versions newest first. */
export type SourceApp = {
  readonly bundleId: string
  readonly name: string
  readonly developer?: string
  readonly subtitle?: string
  readonly description?: string
  readonly versions: readonly SourceAppVersion[]
}

/** What an app source holds once read: the apps IPAForge can install, and how many it left out. */
export type SourceContent = {
  readonly name: string
  readonly subtitle?: string
  readonly website?: string
  readonly apps: readonly SourceApp[]
  /** Apps left out: no version with an https `.ipa` download, or not in the expected shape. */
  readonly skipped: number
}

/** `catalog` is IPAForge's own catalog (GitHub releases); `altstore` an app source in the AltStore format. */
export type SourceKind = 'catalog' | 'altstore'

/** A source as the user manages it: which one, where, and whether its apps are shown. */
export type SourceEntry = {
  readonly id: string
  readonly kind: SourceKind
  readonly url: string
  /** Built in and trusted: can be turned off, not removed. */
  readonly builtin: boolean
  readonly enabled: boolean
}

/** A source with what IPAForge last read from it. */
export type SourceInfo = SourceEntry & {
  readonly name: string
  readonly appCount: number
  readonly skipped: number
  /** When its apps were last read; undefined when never. */
  readonly fetchedAt?: Date
  /** Why the last refresh failed (an ErrorCode); its last good copy is still shown. */
  readonly error?: string
}

/** The apps of one AltStore-format source. */
export type SourceApps = {
  readonly sourceId: string
  readonly sourceName: string
  readonly builtin: boolean
  readonly apps: readonly SourceApp[]
}
