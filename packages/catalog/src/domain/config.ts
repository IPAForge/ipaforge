// Catalog tunables, with the defaults the app ships with.

export interface CatalogConfig {
  /** Remote manifest; updated by pull request to catalog/sources.json, no app release needed. */
  readonly manifestUrl: string;
  readonly githubApi: string;
  /** Largest download accepted (IPAs). */
  readonly maxDownloadBytes: number;
  readonly requestTimeoutMs: number;
  /** How long a fetched manifest is reused before fetching again. */
  readonly manifestTtlMs: number;
}

export const DEFAULT_CATALOG_CONFIG: CatalogConfig = {
  manifestUrl: "https://raw.githubusercontent.com/SirReaDy/loadstar/main/catalog/sources.json",
  githubApi: "https://api.github.com",
  maxDownloadBytes: 2 * 1024 * 1024 * 1024,
  requestTimeoutMs: 30_000,
  manifestTtlMs: 60 * 60 * 1000,
};
