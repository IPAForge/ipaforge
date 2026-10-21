// The main screens the browser tests show, each brought to the state worth checking (and photographing).
import {
  appsShown,
  checklistShown,
  developerShown,
  fillPreload,
  logsShown,
  openAddAllToSideStore,
  openPairingFiles,
  planShown,
  pressInstall,
  recoveryShown,
  renderChangelog,
  renderScreen,
  renderUpdateScreen,
  renderWhatsNew,
  repairShown,
  type ScreenOptions,
  showSources
} from '@ui/__tests__/screens.ts'

const NEXT = '0.1.0-alpha.99'
const RELEASE = `https://github.com/IPAForge/ipaforge/releases/tag/v${NEXT}`

export const screens = {
  'install-home': async (options: ScreenOptions) => {
    await renderScreen('/install', options)
    await planShown()
  },
  'install-failed': async (options: ScreenOptions) => {
    await renderScreen('/install', { ...options, scenario: 'device-locked' })
    await planShown()
    await pressInstall()
    await recoveryShown()
  },
  preload: async (options: ScreenOptions) => {
    await renderScreen('/preload', options)
    await fillPreload()
  },
  'preload-sources': async (options: ScreenOptions) => {
    await renderScreen('/preload', options)
    await showSources()
  },
  'sidestore-qr': async (options: ScreenOptions) => {
    await renderScreen('/preload', { ...options, scenario: 'sources-added' })
    await showSources()
    await openAddAllToSideStore()
  },
  devices: async (options: ScreenOptions) => {
    await renderScreen('/devices', { ...options, scenario: 'checklist-todo' })
    await checklistShown()
  },
  apps: async (options: ScreenOptions) => {
    await renderScreen('/apps', options)
    await appsShown()
  },
  'pairing-files': async (options: ScreenOptions) => {
    await renderScreen('/apps', options)
    await appsShown()
    await openPairingFiles()
  },
  developer: async (options: ScreenOptions) => {
    await renderScreen('/developer', options)
    await developerShown()
  },
  repair: async (options: ScreenOptions) => {
    await renderScreen('/apps/sidestore', {
      ...options,
      scenario: 'sidestore-unknown'
    })
    await repairShown()
  },
  logs: async (options: ScreenOptions) => {
    await renderScreen('/logs', options)
    await logsShown()
  },
  settings: async (options: ScreenOptions) => {
    await renderScreen('/settings', options)
  },
  'whats-new': renderWhatsNew,
  changelog: renderChangelog,
  'update-downloading': async (options: ScreenOptions) => {
    await renderUpdateScreen(
      {
        phase: 'downloading',
        version: NEXT,
        transferred: 41_000_000,
        total: 102_000_000,
        bytesPerSecond: 6_400_000
      },
      options
    )
  },
  'update-failed': async (options: ScreenOptions) => {
    await renderUpdateScreen(
      {
        phase: 'failed',
        version: NEXT,
        reason: 'net::ERR_CONNECTION_RESET',
        url: RELEASE
      },
      options
    )
  },
  'update-manual': async (options: ScreenOptions) => {
    await renderUpdateScreen(
      {
        phase: 'manual',
        version: NEXT,
        packageType: 'deb',
        fileName: `IPAForge-${NEXT}-linux-amd64.deb`,
        url: RELEASE
      },
      options
    )
  }
} satisfies Record<string, (options: ScreenOptions) => Promise<void>>
