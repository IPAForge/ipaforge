// The manifest: the remote copy on `main` when reachable (reused for `manifestTtlMs`), otherwise the built-in one.
import { DEFAULT_MANIFEST } from '@catalog/domain/default-manifest.ts'
import { manifestSchema } from '@catalog/domain/manifest.ts'
import type { Manifest } from '@catalog/domain/types.ts'
import type { CatalogDeps } from '@catalog/types.ts'
import { readBody, utf8Decode } from '@ipaforge/kernel'

const MAX_MANIFEST_BYTES = 1024 * 1024

export type ManifestSource = (signal?: AbortSignal) => Promise<Manifest>

const fetchManifest = async (
  deps: CatalogDeps,
  signal?: AbortSignal
): Promise<Manifest> => {
  const timeout = AbortSignal.timeout(deps.config.requestTimeoutMs)
  const response = await deps.http.request({
    method: 'GET',
    url: deps.config.manifestUrl,
    headers: { Accept: 'application/json', 'User-Agent': 'IPAForge' },
    signal: signal ? AbortSignal.any([signal, timeout]) : timeout
  })
  const body = await readBody(response, MAX_MANIFEST_BYTES)
  if (response.status !== 200) throw new Error(`HTTP ${response.status}`)
  return manifestSchema.parse(JSON.parse(utf8Decode(body)))
}

export const createManifestSource = (deps: CatalogDeps): ManifestSource => {
  let cached: { manifest: Manifest; fetchedAt: number } | undefined

  return async (signal) => {
    const now = deps.clock.now().getTime()
    if (cached && now - cached.fetchedAt < deps.config.manifestTtlMs)
      return cached.manifest
    try {
      cached = { manifest: await fetchManifest(deps, signal), fetchedAt: now }
      return cached.manifest
    } catch (error) {
      deps.logger.warn('remote catalog unavailable; using the built-in one', {
        cause: error
      })
      return cached?.manifest ?? DEFAULT_MANIFEST
    }
  }
}
