// Public API of @loadstar/catalog: what can be installed, which release, and downloading it safely.
export {
  type Catalog,
  createCatalog,
  type DownloadProgress,
  type DownloadResult,
} from "@catalog/application/catalog.ts";
export { type CatalogDeps, type CatalogDepsInput, resolveCatalogDeps } from "@catalog/deps.ts";
export { type CatalogConfig, DEFAULT_CATALOG_CONFIG } from "@catalog/domain/config.ts";
export { DEFAULT_MANIFEST } from "@catalog/domain/default-manifest.ts";
export {
  type AppKind,
  type CatalogApp,
  type Channel,
  type Manifest,
  manifestSchema,
  type Release,
  type ReleaseLocation,
  recommendedChannel,
  supportsIos,
} from "@catalog/domain/manifest.ts";
export type { DownloadStore } from "@catalog/domain/ports/download-store.ts";
export type { ResolvedRelease } from "@catalog/domain/release.ts";
