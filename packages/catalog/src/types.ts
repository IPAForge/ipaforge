import type { CatalogConfig } from '@catalog/domain/config.ts'
import type { DownloadStore } from '@catalog/domain/ports/download-store.ts'
import type { Clock, HttpClient, Logger } from '@loadstar/kernel'

export type CatalogDeps = {
  readonly http: HttpClient
  readonly store: DownloadStore
  readonly logger: Logger
  readonly clock: Clock
  readonly config: CatalogConfig
}

export type CatalogDepsInput = Pick<CatalogDeps, 'http' | 'store'> &
  Partial<Omit<CatalogDeps, 'http' | 'store' | 'config'>> & {
    readonly config?: Partial<CatalogConfig>
  }
