// Development only: `?update=<phase>` shows the update screen in a browser, as the desktop app would on launch.
import type { UpdateSource, UpdateState } from '@ipaforge/rpc'
import { createFixedUpdateSource } from '@ui/services/updates/fixed-update-source.ts'

const NEXT = '0.1.0-alpha.99'
const RELEASE = `https://github.com/IPAForge/ipaforge/releases/tag/v${NEXT}`

/** A sample state for each phase. */
const sampleStates: Readonly<Record<string, UpdateState>> = {
  checking: { phase: 'checking' },
  downloading: {
    phase: 'downloading',
    version: NEXT,
    transferred: 41_000_000,
    total: 102_000_000,
    bytesPerSecond: 6_400_000
  },
  installing: { phase: 'installing', version: NEXT },
  failed: {
    phase: 'failed',
    version: NEXT,
    reason: 'net::ERR_CONNECTION_RESET',
    url: RELEASE
  },
  manual: {
    phase: 'manual',
    version: NEXT,
    packageType: 'msi',
    fileName: `IPAForge-${NEXT}-win-x64.msi`,
    url: RELEASE
  }
}

export const updatesFromSearch = (search: string): UpdateSource =>
  createFixedUpdateSource(
    sampleStates[new URLSearchParams(search).get('update') ?? '']
  )
