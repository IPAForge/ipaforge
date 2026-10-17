import { DEFAULT_CATALOG_CONFIG } from '@catalog/domain/config.ts'
import type { CatalogDeps, CatalogDepsInput } from '@catalog/types.ts'
import { silentLogger, systemClock } from '@loadstar/kernel'

export const resolveCatalogDeps = (input: CatalogDepsInput): CatalogDeps => ({
  http: input.http,
  store: input.store,
  logger: (input.logger ?? silentLogger).child({ scope: 'catalog' }),
  clock: input.clock ?? systemClock,
  config: { ...DEFAULT_CATALOG_CONFIG, ...input.config }
})
