// What's saved about app sources: the ones the user added (in order) and the ones turned off, plus each source's last
// good copy. A file that can't be read is treated as empty rather than failing Preload.
import { z } from 'zod'

import type { SourceStore } from '@catalog/domain/ports/source-store.ts'
import type { SourceContent } from '@catalog/domain/types.ts'
import { utf8Decode, utf8Encode } from '@ipaforge/kernel'

const STATE_KEY = 'sources'
const copyKey = (id: string) => `source/${id}`

const stateSchema = z.object({
  added: z.array(z.object({ url: z.string() })),
  disabled: z.array(z.string())
})

export type SourceState = z.infer<typeof stateSchema>

const versionSchema = z.object({
  version: z.string(),
  date: z.string().optional(),
  downloadUrl: z.string(),
  size: z.number().optional(),
  minOsVersion: z.string().optional()
})

const copySchema = z.object({
  fetchedAt: z.iso.datetime(),
  content: z.object({
    name: z.string(),
    subtitle: z.string().optional(),
    website: z.string().optional(),
    skipped: z.number(),
    apps: z.array(
      z.object({
        bundleId: z.string(),
        name: z.string(),
        developer: z.string().optional(),
        subtitle: z.string().optional(),
        description: z.string().optional(),
        versions: z.array(versionSchema)
      })
    )
  })
})

const EMPTY: SourceState = { added: [], disabled: [] }

const readJson = async <T>(
  store: SourceStore,
  key: string,
  schema: z.ZodType<T>
): Promise<T | undefined> => {
  const bytes = await store.get(key)

  if (!bytes) return
  try {
    const parsed = schema.safeParse(JSON.parse(utf8Decode(bytes)))

    return parsed.success ? parsed.data : undefined
  } catch {
    return undefined
  }
}

const writeJson = (store: SourceStore, key: string, value: unknown) =>
  store.set(key, utf8Encode(JSON.stringify(value)))

export const readState = async (store: SourceStore): Promise<SourceState> =>
  (await readJson(store, STATE_KEY, stateSchema)) ?? EMPTY

export const writeState = (store: SourceStore, state: SourceState) =>
  writeJson(store, STATE_KEY, state)

/** A source's last good copy, with when it was read. */
export const readCopy = async (
  store: SourceStore,
  id: string
): Promise<{ fetchedAt: Date; content: SourceContent } | undefined> => {
  const copy = await readJson(store, copyKey(id), copySchema)

  return copy
    ? {
        fetchedAt: new Date(copy.fetchedAt),
        content: copy.content as SourceContent
      }
    : undefined
}

export const writeCopy = (
  store: SourceStore,
  id: string,
  fetchedAt: Date,
  content: SourceContent
) =>
  writeJson(store, copyKey(id), { fetchedAt: fetchedAt.toISOString(), content })

export const deleteCopy = (store: SourceStore, id: string) =>
  store.delete(copyKey(id))
