import { type CatalogConfig, DEFAULT_CATALOG_CONFIG } from "@catalog/domain/config.ts";
import type { DownloadStore } from "@catalog/domain/ports/download-store.ts";
import { type Clock, type HttpClient, type Logger, silentLogger, systemClock } from "@loadstar/kernel";

export interface CatalogDeps {
  readonly http: HttpClient;
  readonly store: DownloadStore;
  readonly logger: Logger;
  readonly clock: Clock;
  readonly config: CatalogConfig;
}

export type CatalogDepsInput = Pick<CatalogDeps, "http" | "store"> &
  Partial<Omit<CatalogDeps, "http" | "store" | "config">> & { readonly config?: Partial<CatalogConfig> };

export const resolveCatalogDeps = (input: CatalogDepsInput): CatalogDeps => ({
  http: input.http,
  store: input.store,
  logger: (input.logger ?? silentLogger).child({ scope: "catalog" }),
  clock: input.clock ?? systemClock,
  config: { ...DEFAULT_CATALOG_CONFIG, ...input.config },
});
