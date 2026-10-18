import type {
  NewPreloadItem,
  PreloadItem,
  PreloadStore
} from '@ui/state/preload/types.ts'

/** The same app, however it was added again: the same path, link or catalog app (a refused file by its name). */
const sameAs = (item: NewPreloadItem) => {
  const { source } = item
  if (!source) return `refused:${item.label}`
  if (source.kind === 'file') return `file:${source.path}`
  if (source.kind === 'url') return `url:${source.url}`
  return `catalog:${source.appId}`
}

export const createPreloadStore = (): PreloadStore => {
  const listeners = new Set<() => void>()
  let items: readonly PreloadItem[] = []
  let next = 0

  const set = (nextItems: readonly PreloadItem[]) => {
    items = nextItems
    for (const listener of [...listeners]) listener()
  }

  return {
    getState: () => items,
    subscribe: (listener) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    add: (added) => {
      const known = new Set(items.map(sameAs))
      const fresh = added.filter((item) => {
        const key = sameAs(item)
        if (known.has(key)) return false
        known.add(key)
        return true
      })
      if (fresh.length === 0) return
      set([
        ...items,
        ...fresh.map((item) => ({ ...item, id: `app-${++next}` }))
      ])
    },
    remove: (id) => set(items.filter((item) => item.id !== id)),
    clear: () => set([])
  }
}
