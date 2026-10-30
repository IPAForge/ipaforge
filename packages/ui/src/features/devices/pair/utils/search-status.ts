import type { PairableSearch } from '@ui/features/devices/pair/types.ts'

/** What the search line says: still looking (for the first device, or for others), or that it stopped. */
export const searchStatusKey = (search: PairableSearch) => {
  if (search.hasFailed) return 'pairByCode.failed'
  return search.devices.length > 0
    ? 'pairByCode.searchingMore'
    : 'pairByCode.searching'
}
