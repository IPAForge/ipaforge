// GitHub release lookup through the REST API. Projects move and repositories disappear, so "gone" and "no such
// asset" are ordinary results the caller handles (by trying a mirror), not exceptions.

import { z } from 'zod'

import type { CatalogDeps } from '@catalog/deps.ts'
import {
  compact,
  ErrorCode,
  type HttpResponse,
  LoadstarError,
  readBody,
  utf8Decode
} from '@loadstar/kernel'

const MAX_API_BYTES = 8 * 1024 * 1024
const SHA256_PREFIX = 'sha256:'

const releaseSchema = z.looseObject({
  tag_name: z.string(),
  published_at: z.string().nullable().optional(),
  assets: z.array(
    z.looseObject({
      name: z.string(),
      browser_download_url: z.string().url().startsWith('https://'),
      size: z.number().int().nonnegative(),
      /** "sha256:<hex>" (GitHub computes it for release assets). */
      digest: z.string().nullable().optional()
    })
  )
})

type GithubRelease = z.infer<typeof releaseSchema>

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

const releaseUrl = (deps: CatalogDeps, { repo, tag }: GithubQuery): string =>
  `${deps.config.githubApi}/repos/${repo}/${tag ? `releases/tags/${encodeURIComponent(tag)}` : 'releases/latest'}`

const header = (response: HttpResponse, name: string): string | undefined =>
  Object.entries(response.headers).find(
    ([key]) => key.toLowerCase() === name
  )?.[1]

const isRateLimited = (response: HttpResponse): boolean =>
  response.status === 429 ||
  (response.status === 403 && header(response, 'x-ratelimit-remaining') === '0')

const fetchRelease = async (
  deps: CatalogDeps,
  query: GithubQuery,
  signal?: AbortSignal
): Promise<GithubRelease | undefined> => {
  const timeout = AbortSignal.timeout(deps.config.requestTimeoutMs)
  const response = await deps.http.request({
    method: 'GET',
    url: releaseUrl(deps, query),
    headers: {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'Loadstar'
    },
    signal: signal ? AbortSignal.any([signal, timeout]) : timeout
  })
  const body = await readBody(response, MAX_API_BYTES)
  if (response.status === 404) return undefined
  if (isRateLimited(response))
    throw new LoadstarError(ErrorCode.GithubRateLimited, {
      data: { repo: query.repo }
    })
  if (response.status !== 200) {
    throw new LoadstarError(ErrorCode.CatalogUnavailable, {
      message: `GitHub answered HTTP ${response.status} for ${query.repo}`,
      data: { repo: query.repo, status: response.status }
    })
  }
  return releaseSchema.parse(JSON.parse(utf8Decode(body)))
}

const sha256Of = (digest: string | null | undefined): string | undefined =>
  digest?.startsWith(SHA256_PREFIX)
    ? digest.slice(SHA256_PREFIX.length).toLowerCase()
    : undefined

export const findGithubAsset = async (
  deps: CatalogDeps,
  query: GithubQuery,
  signal?: AbortSignal
): Promise<GithubLookup> => {
  const release = await fetchRelease(deps, query, signal)
  if (!release) return { kind: 'gone' }
  const asset = release.assets.find(
    (candidate) => candidate.name === query.asset
  )
  if (!asset) return { kind: 'no-asset', version: release.tag_name }
  return {
    kind: 'found',
    asset: compact({
      version: release.tag_name,
      url: asset.browser_download_url,
      name: asset.name,
      size: asset.size,
      sha256: sha256Of(asset.digest),
      publishedAt: release.published_at
        ? new Date(release.published_at)
        : undefined
    })
  }
}
