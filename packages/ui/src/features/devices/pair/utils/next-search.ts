import type { PairableSearch } from '@ui/features/devices/pair/types.ts'
import type { PairableWatchEvent } from '@ui/services/engine/types.ts'

/** The search after one of its events: a device found (or found again, updated) or gone, or the search stopped. */
export const nextSearch = (
  search: PairableSearch,
  event: PairableWatchEvent
): PairableSearch => {
  if (event.kind === 'denied') return { ...search, isDenied: true }
  if (event.kind === 'failed') return { ...search, hasFailed: true }
  const others = search.devices.filter((device) =>
    event.kind === 'found'
      ? device.id !== event.device.id
      : device.id !== event.id
  )

  return {
    ...search,
    devices: event.kind === 'found' ? [...others, event.device] : others
  }
}
