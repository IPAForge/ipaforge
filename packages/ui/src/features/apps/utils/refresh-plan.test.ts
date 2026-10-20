import { describe, expect, it } from 'vitest'

import { refreshPlan } from '@ui/features/apps/utils/refresh-plan.ts'
import type { InstalledApp } from '@ui/services/engine/types.ts'

const SIDESTORE = 'com.SideStore.SideStore.TEAM'
const origin = {
  kind: 'catalog',
  appId: 'sidestore',
  channel: 'stable'
} as const

/** SideStore as IPAForge installed it, at `installed`, with this computer's copy of `kept` (none: from elsewhere). */
const sideStore = (installed: string, kept?: string): InstalledApp => ({
  bundleId: SIDESTORE,
  name: 'SideStore',
  version: installed,
  teamId: 'TEAM',
  marker: {
    originalBundleId: 'com.SideStore.SideStore',
    origin,
    certificateSerial: 'AAAA01'
  },
  ...(kept
    ? {
        record: {
          udid: 'UDID',
          bundleId: SIDESTORE,
          originalBundleId: 'com.SideStore.SideStore',
          name: 'SideStore',
          version: kept,
          origin,
          installedAt: '2026-10-13T10:00:00Z',
          keptKey: 'kept'
        }
      }
    : {})
})

const plan = (app: InstalledApp) =>
  refreshPlan(app, 'IPAForge catalog', [], [], 'IPAForge catalog')

describe('refreshPlan', () => {
  it("uses this computer's copy when it is the version on the device", () => {
    expect(plan(sideStore('0.6.2', '0.6.2'))).toEqual({ kind: 'kept' })
  })

  it('downloads the version on the device when the copy is another one (the app updated itself) or there is none', () => {
    for (const app of [sideStore('0.6.3', '0.6.2'), sideStore('0.6.3')])
      expect(plan(app)).toEqual({
        kind: 'source',
        source: { ...origin, version: '0.6.3' },
        from: 'IPAForge catalog'
      })
  })
})
