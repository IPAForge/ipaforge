// App sources: IPAForge's catalog and SideStore's source built in, plus the AltStore-format sources the user adds.
// Each source's last good copy is saved, so Preload still shows its apps when it can't be reached; the failure is kept
// (in memory) and shown next to it.
import {
  fetchSource,
  normaliseSourceUrl
} from '@catalog/application/source-fetch.ts'
import {
  deleteCopy,
  readCopy,
  readState,
  type SourceState,
  writeCopy,
  writeState
} from '@catalog/application/source-state.ts'
import type { Sources } from '@catalog/application/types.ts'
import { builtinSources } from '@catalog/domain/builtin-sources.ts'
import type {
  Manifest,
  SourceApps,
  SourceContent,
  SourceEntry,
  SourceInfo
} from '@catalog/domain/types.ts'
import type { CatalogDeps } from '@catalog/types.ts'
import { compact, ErrorCode, IPAForgeError } from '@ipaforge/kernel'

type Copy = { readonly fetchedAt: Date; readonly content: SourceContent }

const CATALOG_NAME = 'IPAForge catalog'

const entriesOf = (deps: CatalogDeps, state: SourceState): SourceEntry[] => {
  const disabled = new Set(state.disabled)
  const all: SourceEntry[] = [
    ...builtinSources(deps.config.manifestUrl),
    ...state.added.map(({ url }) => ({
      id: url,
      kind: 'altstore' as const,
      url,
      builtin: false,
      enabled: true
    }))
  ]

  return all.map((entry) => ({ ...entry, enabled: !disabled.has(entry.id) }))
}

const hostOf = (url: string) => new URL(url).host

export const createSources = (
  deps: CatalogDeps,
  manifest: (signal?: AbortSignal) => Promise<Manifest>
): Sources => {
  const store = deps.sourceStore
  const copies = new Map<string, Copy>()
  const errors = new Map<string, string>()
  // Saved-state changes run one after another, so two at once can't lose either.
  let queue: Promise<unknown> = Promise.resolve()
  const change = <T>(update: () => Promise<T>): Promise<T> => {
    const next = queue.then(update)

    queue = next.catch(() => undefined)

    return next
  }

  const entries = async () => entriesOf(deps, await readState(store))

  const copyOf = async (id: string): Promise<Copy | undefined> => {
    const known = copies.get(id)

    if (known) return known

    const saved = await readCopy(store, id)

    if (saved) copies.set(id, saved)

    return saved
  }

  const isFresh = (copy: Copy) =>
    deps.clock.now().getTime() - copy.fetchedAt.getTime() <
    deps.config.sourceTtlMs

  /** Reads the source again (when forced, or its copy is missing or old); on failure keeps the old copy. */
  const load = async (
    entry: SourceEntry,
    force: boolean,
    signal?: AbortSignal
  ): Promise<Copy | undefined> => {
    const copy = await copyOf(entry.id)

    if (!force && copy && isFresh(copy)) return copy
    try {
      const fresh = {
        fetchedAt: deps.clock.now(),
        content: await fetchSource(deps, entry.url, signal)
      }

      copies.set(entry.id, fresh)
      errors.delete(entry.id)
      await writeCopy(store, entry.id, fresh.fetchedAt, fresh.content)

      return fresh
    } catch (error) {
      const code =
        error instanceof IPAForgeError
          ? error.code
          : ErrorCode.AppSourceUnreachable

      errors.set(entry.id, code)
      deps.logger.warn('app source not refreshed', { url: entry.url, code })

      return copy
    }
  }

  const infoOf = async (
    entry: SourceEntry,
    signal?: AbortSignal
  ): Promise<SourceInfo> => {
    if (entry.kind === 'catalog') {
      const apps = (await manifest(signal)).apps.length

      return { ...entry, name: CATALOG_NAME, appCount: apps, skipped: 0 }
    }

    const copy = await copyOf(entry.id)

    return compact({
      ...entry,
      name: copy?.content.name ?? hostOf(entry.url),
      appCount: copy?.content.apps.length ?? 0,
      skipped: copy?.content.skipped ?? 0,
      fetchedAt: copy?.fetchedAt,
      error: errors.get(entry.id)
    })
  }

  const list = async (signal?: AbortSignal) =>
    Promise.all((await entries()).map((entry) => infoOf(entry, signal)))

  const check = async (url: string, signal?: AbortSignal) => {
    const normalised = normaliseSourceUrl(url)

    if (
      (await entries()).some(
        (entry) => entry.url === normalised || entry.url === url.trim()
      )
    )
      throw new IPAForgeError(ErrorCode.AppSourceExists, {
        message: 'source already added',
        data: { url: normalised }
      })

    return {
      url: normalised,
      content: await fetchSource(deps, normalised, signal)
    }
  }

  const altstoreOn = (all: readonly SourceEntry[]) =>
    all.filter((entry) => entry.kind === 'altstore' && entry.enabled)

  return {
    list,
    apps: async (signal) => {
      const loaded = await Promise.all(
        altstoreOn(await entries()).map(async (entry) => {
          const copy = await load(entry, false, signal)

          return copy
            ? [
                {
                  sourceId: entry.id,
                  sourceName: copy.content.name,
                  builtin: entry.builtin,
                  apps: copy.content.apps
                } satisfies SourceApps
              ]
            : []
        })
      )

      return loaded.flat()
    },
    check,
    add: async (url, signal) => {
      const preview = await check(url, signal)

      return change(async () => {
        const state = await readState(store)
        const fetchedAt = deps.clock.now()

        await writeState(store, {
          ...state,
          added: [...state.added, { url: preview.url }]
        })
        await writeCopy(store, preview.url, fetchedAt, preview.content)
        copies.set(preview.url, { fetchedAt, content: preview.content })
        deps.logger.info('app source added', { url: preview.url })

        const entry = (await entries()).find(
          (candidate) => candidate.id === preview.url
        )

        if (!entry)
          throw new IPAForgeError(ErrorCode.AppSourceInvalid, {
            message: 'source not saved'
          })

        return infoOf(entry)
      })
    },
    remove: (id) =>
      change(async () => {
        const state = await readState(store)

        await writeState(store, {
          added: state.added.filter((source) => source.url !== id),
          disabled: state.disabled.filter((source) => source !== id)
        })
        await deleteCopy(store, id)
        copies.delete(id)
        errors.delete(id)
        deps.logger.info('app source removed', { url: id })
      }),
    setEnabled: (id, enabled) =>
      change(async () => {
        const state = await readState(store)
        const others = state.disabled.filter((source) => source !== id)

        await writeState(store, {
          ...state,
          disabled: enabled ? others : [...others, id]
        })
      }),
    refresh: async (id, signal) => {
      const all = await entries()
      const targets = id
        ? all.filter((entry) => entry.id === id && entry.kind === 'altstore')
        : altstoreOn(all)

      await Promise.all(targets.map((entry) => load(entry, true, signal)))

      return list(signal)
    }
  }
}
