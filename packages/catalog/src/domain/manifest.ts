// What Loadstar can install, as data. Release locations change (repositories move or disappear), so they live in a
// manifest that is updated remotely without an app release; the built-in copy is the fallback.
import { z } from 'zod'

const sha256 = z
  .string()
  .regex(/^[0-9a-f]{64}$/i, 'SHA-256 as 64 hex characters')

/** A GitHub release asset. `tag` defaults to the latest release. */
const githubSchema = z.object({
  repo: z.string().regex(/^[\w.-]+\/[\w.-]+$/, 'owner/name'),
  tag: z.string().min(1).optional(),
  /** Exact asset name, e.g. `SideStore.ipa`. */
  asset: z.string().min(1)
})

const githubLocationSchema = z.object({
  github: githubSchema,
  sha256: sha256.optional()
})

const urlLocationSchema = z.object({
  url: z.url().startsWith('https://'),
  // A direct download has no other integrity source, so its checksum is mandatory.
  sha256,
  size: z.number().int().positive().optional()
})

const locationSchema = z.union([githubLocationSchema, urlLocationSchema])

const releaseSchema = z.intersection(
  locationSchema,
  z.object({ mirrors: z.array(locationSchema).optional() })
)

const compatibilitySchema = z.object({
  /** Inclusive lower bound, e.g. "26.4". */
  iosFrom: z
    .string()
    .regex(/^\d+(\.\d+){0,2}$/)
    .optional(),
  /** Exclusive upper bound. */
  iosBefore: z
    .string()
    .regex(/^\d+(\.\d+){0,2}$/)
    .optional(),
  channel: z.enum(['stable', 'nightly']),
  note: z.string().optional()
})

export const appKinds = ['sidestore', 'livecontainer-sidestore', 'app'] as const

const appSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string().min(1),
  /** Original bundle identifier (before sideload renaming). */
  bundleId: z.string().min(1),
  kind: z.enum(appKinds),
  minimumIos: z
    .string()
    .regex(/^\d+(\.\d+){0,2}$/)
    .optional(),
  channels: z.object({
    stable: releaseSchema.optional(),
    nightly: releaseSchema.optional()
  }),
  /** Which channel to recommend per iOS range (first match wins). */
  compatibility: z.array(compatibilitySchema).optional()
})

export const manifestSchema = z.object({
  version: z.literal(1),
  apps: z.array(appSchema).min(1)
})

export type Manifest = z.infer<typeof manifestSchema>
export type CatalogApp = z.infer<typeof appSchema>
export type Release = z.infer<typeof releaseSchema>
export type ReleaseLocation = z.infer<typeof locationSchema>
export type GithubLocation = z.infer<typeof githubLocationSchema>
export type UrlLocation = z.infer<typeof urlLocationSchema>
export type Channel = 'stable' | 'nightly'
export type AppKind = (typeof appKinds)[number]

const compareVersions = (a: string, b: string): number => {
  const pa = a.split('.').map(Number)
  const pb = b.split('.').map(Number)
  for (let i = 0; i < 3; i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0)
    if (diff !== 0) return diff
  }
  return 0
}

/** The channel to recommend for this iOS version (default: stable when it exists). */
export const recommendedChannel = (
  app: CatalogApp,
  iosVersion?: string
): Channel => {
  if (iosVersion) {
    for (const rule of app.compatibility ?? []) {
      const fromOk =
        !rule.iosFrom || compareVersions(iosVersion, rule.iosFrom) >= 0
      const beforeOk =
        !rule.iosBefore || compareVersions(iosVersion, rule.iosBefore) < 0
      if (fromOk && beforeOk && app.channels[rule.channel]) return rule.channel
    }
  }
  return app.channels.stable ? 'stable' : 'nightly'
}

/** True when the device's iOS meets the app's minimum. */
export const supportsIos = (app: CatalogApp, iosVersion: string): boolean =>
  !app.minimumIos || compareVersions(iosVersion, app.minimumIos) >= 0
