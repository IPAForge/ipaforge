import { describe, expect, it } from 'vitest'

import type { AppView } from '@ui/features/apps/types.ts'
import { refreshBatch } from '@ui/features/apps/utils/refresh-batch.ts'

const view = (bundleId: string, refresh: AppView['refresh']): AppView => ({
  app: { bundleId, name: bundleId, version: '1.0', teamId: 'TEAM' },
  daysLeft: 1,
  tone: 'soon',
  from: undefined,
  update: undefined,
  refresh
})

const kept = view('kept', { kind: 'kept' })
const marked = view('marked', { kind: 'profile' })
const fromCatalog = view('catalog', {
  kind: 'source',
  source: { kind: 'catalog', appId: 'sidestore' },
  from: 'IPAForge catalog'
})

describe('refreshBatch', () => {
  it('gives new profiles to the apps the Engine says can keep their certificate', () => {
    const batch = refreshBatch(
      [kept, marked, fromCatalog],
      [
        { bundleId: 'kept', kind: 'profile' },
        { bundleId: 'marked', kind: 'profile' },
        { bundleId: 'catalog', kind: 'reinstall', reason: 'certificate' }
      ]
    )

    expect(batch.profiles).toEqual([kept, marked])
    expect(batch.reinstall).toEqual([
      { view: fromCatalog, refresh: 'certificate' }
    ])
  })

  it('leaves out an app with nothing to install it from when it needs installing again', () => {
    const batch = refreshBatch(
      [marked, kept],
      [
        { bundleId: 'marked', kind: 'reinstall', reason: 'certificate' },
        { bundleId: 'kept', kind: 'reinstall', reason: 'unmarked' }
      ]
    )

    expect(batch.profiles).toEqual([])
    expect(batch.reinstall).toEqual([{ view: kept, refresh: 'unmarked' }])
  })

  it('installs every app it can again when Apple did not answer', () => {
    const batch = refreshBatch([kept, marked, fromCatalog], undefined)

    expect(batch.profiles).toEqual([])
    expect(batch.reinstall).toEqual([
      { view: kept, refresh: undefined },
      { view: fromCatalog, refresh: undefined }
    ])
  })
})
