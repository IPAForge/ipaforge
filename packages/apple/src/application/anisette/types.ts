import type { AnisetteServer } from '@apple/domain/types.ts'

export type FetchedList = {
  readonly servers: AnisetteServer[]
  readonly fetchedAt: number
}

export type RemoteServerList = {
  /** The remote list, fetched again when older than `anisetteServerListMaxAgeMs`; the last known one otherwise. */
  current(): Promise<AnisetteServer[]>
}
