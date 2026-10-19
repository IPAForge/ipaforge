// Public API of @ipaforge/catalog: what can be installed, which release, and downloading it safely.
export {
  type Catalog,
  createCatalog,
  type DownloadProgress,
  type DownloadResult,
  type SourcePreview,
  type Sources
} from '@catalog/application/catalog.ts'
export { resolveCatalogDeps } from '@catalog/deps.ts'
export { isIpaDownload, readAltStoreSource } from '@catalog/domain/altstore.ts'
export {
  CATALOG_SOURCE_ID,
  SIDESTORE_SOURCE_ID,
  SIDESTORE_SOURCE_URL
} from '@catalog/domain/builtin-sources.ts'
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
export type { SourceStore } from '@catalog/domain/ports/source-store.ts'
export type { ResolvedRelease } from '@catalog/domain/release.ts'
export type {
  AppKind,
  CatalogApp,
  Channel,
  Manifest,
  Release,
  ReleaseLocation,
  SourceApp,
  SourceApps,
  SourceAppVersion,
  SourceContent,
  SourceEntry,
  SourceInfo,
  SourceKind
} from '@catalog/domain/types.ts'
export { createMemorySourceStore } from '@catalog/infrastructure/memory-source-store.ts'
export type { CatalogDeps, CatalogDepsInput } from '@catalog/types.ts'
