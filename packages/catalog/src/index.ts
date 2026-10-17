// Public API of @loadstar/catalog: what can be installed, which release, and downloading it safely.
export {
  type Catalog,
  createCatalog,
  type DownloadProgress,
  type DownloadResult
} from '@catalog/application/catalog.ts'
export { resolveCatalogDeps } from '@catalog/deps.ts'
export {
  type CatalogConfig,
  DEFAULT_CATALOG_CONFIG
} from '@catalog/domain/config.ts'
export { DEFAULT_MANIFEST } from '@catalog/domain/default-manifest.ts'
export {
  manifestSchema,
  recommendedChannel,
  supportsIos
} from '@catalog/domain/manifest.ts'
export type { DownloadStore } from '@catalog/domain/ports/download-store.ts'
export type { ResolvedRelease } from '@catalog/domain/release.ts'
export type {
  AppKind,
  CatalogApp,
  Channel,
  Manifest,
  Release,
  ReleaseLocation
} from '@catalog/domain/types.ts'
export type { CatalogDeps, CatalogDepsInput } from '@catalog/types.ts'
