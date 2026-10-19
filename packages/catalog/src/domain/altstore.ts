// The AltStore source format, the one SideStore reads: a source's name and its apps, each with versions to download.
// Sources are written by hand, so this reads leniently: unknown fields are ignored, an app that doesn't fit is left
// out (and counted) rather than failing the whole source, and so is any version that isn't an https `.ipa` download.
// Older sources put the latest version on the app itself (version, versionDate, downloadURL, size); that counts as
// one more version when `versions` doesn't list it.
import { z } from 'zod'

import type {
  SourceApp,
  SourceAppVersion,
  SourceContent
} from '@catalog/domain/types.ts'
import { compact } from '@ipaforge/kernel'

const text = z.string().trim().min(1)

const versionSchema = z.looseObject({
  version: text,
  date: z.string().optional(),
  downloadURL: z.string(),
  size: z.number().nonnegative().optional(),
  minOSVersion: z.string().optional()
})

const appSchema = z.looseObject({
  name: text,
  bundleIdentifier: text,
  developerName: z.string().optional(),
  subtitle: z.string().optional(),
  localizedDescription: z.string().optional(),
  version: z.string().optional(),
  versionDate: z.string().optional(),
  downloadURL: z.string().optional(),
  size: z.number().nonnegative().optional(),
  minOSVersion: z.string().optional(),
  tintColor: z.unknown().optional(),
  versions: z.array(z.unknown()).optional()
})

const sourceSchema = z.looseObject({
  name: text,
  subtitle: z.string().optional(),
  website: z.string().optional(),
  apps: z.array(z.unknown())
})

type RawApp = z.infer<typeof appSchema>

const IPA_EXTENSION = '.ipa'

const HEX_COLOR = /^#?([\da-f]{6})$/i

/** The app's colour as `#rrggbb`; sources write it with or without the `#`, anything else is dropped. */
const readTint = (value: unknown): string | undefined => {
  const match =
    typeof value === 'string' ? HEX_COLOR.exec(value.trim()) : undefined

  return match?.[1] ? `#${match[1].toLowerCase()}` : undefined
}

/** Only https links whose path ends in `.ipa`: what Preload accepts from a link added by hand. */
export const isIpaDownload = (url: string): boolean => {
  try {
    const parsed = new URL(url)

    return (
      parsed.protocol === 'https:' &&
      parsed.pathname.toLowerCase().endsWith(IPA_EXTENSION)
    )
  } catch {
    return false
  }
}

const readVersion = (value: unknown): SourceAppVersion | undefined => {
  const parsed = versionSchema.safeParse(value)

  if (!parsed.success || !isIpaDownload(parsed.data.downloadURL)) return

  const { version, date, downloadURL, size, minOSVersion } = parsed.data

  return compact({
    version,
    date,
    downloadUrl: downloadURL,
    size,
    minOsVersion: minOSVersion
  })
}

/** The app's own (legacy) latest version, as a version entry. */
const appLevelVersion = (app: RawApp): unknown =>
  app.version && app.downloadURL
    ? {
        version: app.version,
        date: app.versionDate,
        downloadURL: app.downloadURL,
        size: app.size,
        minOSVersion: app.minOSVersion
      }
    : undefined

const versionsOf = (app: RawApp): SourceAppVersion[] => {
  const listed = (app.versions ?? []).flatMap((value) => {
    const version = readVersion(value)

    return version ? [version] : []
  })
  const latest = readVersion(appLevelVersion(app))

  if (latest && !listed.some((entry) => entry.version === latest.version))
    listed.unshift(latest)
  return listed
}

const readApp = (value: unknown): SourceApp | undefined => {
  const parsed = appSchema.safeParse(value)

  if (!parsed.success) return

  const versions = versionsOf(parsed.data)

  if (versions.length === 0) return

  const app = parsed.data

  return compact({
    bundleId: app.bundleIdentifier,
    name: app.name,
    developer: app.developerName,
    subtitle: app.subtitle,
    description: app.localizedDescription,
    tint: readTint(app.tintColor),
    versions
  })
}

/** Reads a parsed source; `undefined` when it isn't an app source at all (no name, or no `apps` list). */
export const readAltStoreSource = (
  json: unknown
): SourceContent | undefined => {
  const parsed = sourceSchema.safeParse(json)

  if (!parsed.success) return

  const apps: SourceApp[] = []
  const seen = new Set<string>()
  let skipped = 0

  for (const value of parsed.data.apps) {
    const app = readApp(value)

    if (!app || seen.has(app.bundleId)) {
      skipped += 1
      continue
    }
    seen.add(app.bundleId)
    apps.push(app)
  }

  const { name, subtitle, website } = parsed.data

  return compact({ name, subtitle, website, apps, skipped })
}
