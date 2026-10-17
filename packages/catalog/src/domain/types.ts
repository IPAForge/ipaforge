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
