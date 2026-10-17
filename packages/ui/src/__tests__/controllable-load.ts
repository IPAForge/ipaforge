import { vi } from 'vitest'

import type { LanguageId } from '@ui/i18n/languages/types.ts'
import { loadLocaleBundle } from '@ui/i18n/loading/locale-bundles.ts'
import type { LoadBundle } from '@ui/i18n/loading/types.ts'

/**
 * The real bundle loader, counting calls, with chosen languages held until `release(language)`
 * or failing with `fail(language)`.
 */
export const createControllableLoad = (held: readonly LanguageId[] = []) => {
  const gates = new Map(
    held.map((language) => {
      const gate = { resolve: () => {}, reject: (_error: Error) => {} }
      const promise = new Promise<void>((resolve, reject) =>
        Object.assign(gate, { resolve, reject })
      )
      promise.catch(() => {}) // a failed gate is awaited only by the load it fails
      return [language, { ...gate, promise }] as const
    })
  )
  const load = vi.fn<LoadBundle>(async (language) => {
    await gates.get(language)?.promise
    return loadLocaleBundle(language)
  })
  const release = (language: LanguageId) => gates.get(language)?.resolve()
  const fail = (language: LanguageId) =>
    gates.get(language)?.reject(new Error(`cannot load ${language}`))

  return { load, release, fail }
}
