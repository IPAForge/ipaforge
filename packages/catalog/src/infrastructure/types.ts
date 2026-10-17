import type { z } from 'zod'

import type { githubReleaseSchema } from '@catalog/infrastructure/github.ts'

export type GithubRelease = z.infer<typeof githubReleaseSchema>

export type GithubAsset = {
  readonly version: string
  readonly url: string
  readonly name: string
  readonly size: number
  readonly sha256?: string
  readonly publishedAt?: Date
}

export type GithubLookup =
  | { readonly kind: 'found'; readonly asset: GithubAsset }
  | { readonly kind: 'gone' }
  | { readonly kind: 'no-asset'; readonly version: string }

export type GithubQuery = {
  readonly repo: string
  /** Release tag; the latest release when omitted. */
  readonly tag?: string | undefined
  readonly asset: string
}
