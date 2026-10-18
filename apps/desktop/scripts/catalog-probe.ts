// Maintainer tool: checks the catalog against the real manifest and GitHub (no account needed).
//
//   pnpm --filter @ipaforge/desktop catalog-probe              # resolve every app and channel
//   pnpm --filter @ipaforge/desktop catalog-probe download sidestore stable   # also download (to a temp cache)
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { createFileDownloadStore } from '@desktop/main/adapters/file-download-store.ts'
import { createNodeHttpClient } from '@desktop/main/adapters/http-client.ts'
import {
  type Catalog,
  type Channel,
  createCatalog,
  type DownloadProgress
} from '@ipaforge/catalog'
import { IPAForgeError } from '@ipaforge/kernel'

const CHANNELS = ['stable', 'nightly'] as const

const describe = (error: unknown) =>
  error instanceof IPAForgeError
    ? `${error.code} ${JSON.stringify(error.data ?? {})}`
    : String(error)

/** Resolves one channel of one app and prints the release, or why it could not be resolved. */
const printRelease = async (
  catalog: Catalog,
  appId: string,
  channel: Channel
) => {
  try {
    const release = await catalog.resolve(appId, channel)
    console.log(
      `${appId} ${channel}: ${release.version} ${release.fileName} ${release.size ?? '?'} bytes, sha256 ${release.sha256 ? 'published' : 'not published'}, from ${release.from}`
    )
  } catch (error) {
    console.log(`${appId} ${channel}: ✗ ${describe(error)}`)
  }
}

const printEveryRelease = async (catalog: Catalog) => {
  const manifest = await catalog.manifest()
  for (const app of manifest.apps) {
    for (const channel of CHANNELS) {
      if (app.channels[channel]) await printRelease(catalog, app.id, channel)
    }
  }
}

/** Prints progress in 25% steps. */
const progressPrinter = () => {
  let last = 0

  return ({ received, total }: DownloadProgress) => {
    const percent = total ? Math.floor((received / total) * 100) : 0
    if (percent < last + 25) return
    last = percent
    console.log(`  ${percent}%`)
  }
}

const download = async (
  catalog: Catalog,
  cacheDir: string,
  appId: string,
  channel: Channel
) => {
  const release = await catalog.resolve(appId, channel)
  const result = await catalog.download(release, {
    onProgress: progressPrinter()
  })
  console.log(
    `downloaded ${result.file.size} bytes, sha256 ${result.sha256.slice(0, 16)}…, cache ${cacheDir}`
  )
}

const [command = 'resolve', appId, channel] = process.argv.slice(2)
const cacheDir = await mkdtemp(join(tmpdir(), 'ipaforge-catalog-'))
const catalog = createCatalog({
  http: createNodeHttpClient(),
  store: createFileDownloadStore(cacheDir)
})

await printEveryRelease(catalog)
if (command === 'download' && appId && channel)
  await download(catalog, cacheDir, appId, channel as Channel)
