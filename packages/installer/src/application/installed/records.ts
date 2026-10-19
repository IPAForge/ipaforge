// The apps the Engine installed, remembered per device: one JSON list per device in the InstalledStore, and each
// app's original IPA in the KeptIpaStore. A list that can't be read counts as empty rather than failing.
import { z } from 'zod'

import type { InstalledRecord } from '@installer/domain/types.ts'
import type { InstallerDeps } from '@installer/types.ts'
import { utf8Decode, utf8Encode } from '@ipaforge/kernel'

const channel = z.enum(['stable', 'nightly'])

const originSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('catalog'),
    appId: z.string(),
    channel: channel.optional()
  }),
  z.object({ kind: z.literal('url'), url: z.string() }),
  z.object({ kind: z.literal('file'), name: z.string() })
])

const trustSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('catalog'),
    appId: z.string(),
    sha256: z.string()
  }),
  z.object({ kind: z.literal('user-approved') })
])

const recordSchema = z.object({
  udid: z.string(),
  bundleId: z.string(),
  originalBundleId: z.string(),
  name: z.string(),
  version: z.string().optional(),
  origin: originSchema,
  trust: trustSchema.optional(),
  installedAt: z.string(),
  keptKey: z.string()
})

const listKey = (udid: string) => `installed/${udid}`

/** Where an app's original IPA is kept: one per device and installed bundle id. */
export const keptKeyFor = (udid: string, bundleId: string) =>
  `${udid}/${bundleId}.ipa`

export const readRecords = async (
  deps: Pick<InstallerDeps, 'installed'>,
  udid: string
): Promise<InstalledRecord[]> => {
  const bytes = await deps.installed.get(listKey(udid))

  if (!bytes) return []
  try {
    const parsed = z
      .array(recordSchema)
      .safeParse(JSON.parse(utf8Decode(bytes)))

    return parsed.success ? (parsed.data as InstalledRecord[]) : []
  } catch {
    return []
  }
}

const writeRecords = (
  deps: Pick<InstallerDeps, 'installed'>,
  udid: string,
  records: readonly InstalledRecord[]
) => deps.installed.set(listKey(udid), utf8Encode(JSON.stringify(records)))

/** Saves (or replaces) the record of one installed app. */
export const saveRecord = async (
  deps: Pick<InstallerDeps, 'installed'>,
  record: InstalledRecord
): Promise<void> => {
  const others = (await readRecords(deps, record.udid)).filter(
    (known) => known.bundleId !== record.bundleId
  )

  await writeRecords(deps, record.udid, [...others, record])
}

/** Forgets the apps no longer installed (or removed), and their kept IPAs. */
export const forgetRecords = async (
  deps: Pick<InstallerDeps, 'installed' | 'kept'>,
  udid: string,
  bundleIds: ReadonlySet<string>
): Promise<void> => {
  if (bundleIds.size === 0) return

  const records = await readRecords(deps, udid)
  const gone = records.filter((record) => bundleIds.has(record.bundleId))

  if (gone.length === 0) return
  await writeRecords(
    deps,
    udid,
    records.filter((record) => !bundleIds.has(record.bundleId))
  )
  await Promise.all(gone.map((record) => deps.kept.delete(record.keptKey)))
}
