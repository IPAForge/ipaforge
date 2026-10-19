// Installed apps for the fake Engine: SideStore from the catalog (5 days left), YouTube from a file (6 days left;
// 1 in scenario `apps-due`, inside the refresh window), a LiveContainer build from SideStore's fake source with a newer version there, and an
// app another tool signed with the same team. Refreshing or updating an app gives it 7 more days; Remove deletes it.
// Scenario `apps-expired` starts with YouTube expired; `no-apps` with nothing installed. Nothing is due by default,
// so automatic refresh doesn't start a run in every test. Apps whose mark names their certificate refresh with a
// new profile only; YouTube (installed before marks) and the other tool's app are installed again.
import { bytesFileSource, ErrorCode, IPAForgeError } from '@ipaforge/kernel'
import type { Engine } from '@ipaforge/rpc'
import type { FakeInstalledApp } from '@ui/services/engine/fake/types.ts'

const DAY_MS = 24 * 60 * 60 * 1000
const TEAM = 'FAKETEAM01'
const LIFETIME_DAYS = 7
const CERTIFICATE = 'FAKECERT01'

const inDays = (days: number) => new Date(Date.now() + days * DAY_MS)

const record = (
  bundleId: string,
  originalBundleId: string,
  name: string,
  version: string,
  origin: NonNullable<FakeInstalledApp['record']>['origin']
) => ({
  udid: '',
  bundleId,
  originalBundleId,
  name,
  version,
  origin,
  installedAt: new Date().toISOString(),
  keptKey: `${bundleId}.ipa`
})

/** YouTube's days left: fine by default (nothing refreshes by itself), inside the window, or expired. */
const youtubeDays = (scenario: string): number => {
  if (scenario === 'apps-expired') return -1
  if (scenario === 'apps-due') return 1

  return 6
}

const seed = (scenario: string): FakeInstalledApp[] => {
  if (scenario === 'no-apps') return []

  return [
    {
      bundleId: `com.SideStore.SideStore.${TEAM}`,
      name: 'SideStore',
      version: '0.7.0',
      teamId: TEAM,
      expiresAt: inDays(5),
      record: record(
        `com.SideStore.SideStore.${TEAM}`,
        'com.SideStore.SideStore',
        'SideStore',
        '0.7.0',
        {
          kind: 'catalog',
          appId: 'sidestore',
          channel: 'stable'
        }
      ),
      marker: {
        originalBundleId: 'com.SideStore.SideStore',
        origin: { kind: 'catalog', appId: 'sidestore', channel: 'stable' },
        certificateSerial: CERTIFICATE
      }
    },
    {
      bundleId: `com.google.ios.youtube.${TEAM}`,
      name: 'YouTube',
      version: '21.41.5',
      teamId: TEAM,
      expiresAt: inDays(youtubeDays(scenario)),
      record: record(
        `com.google.ios.youtube.${TEAM}`,
        'com.google.ios.youtube',
        'YouTube',
        '21.41.5',
        {
          kind: 'file',
          name: 'YouTube.ipa'
        }
      )
    },
    {
      bundleId: `com.kdt.livecontainer.beta.${TEAM}`,
      name: 'LiveContainer - BETA NOT MEANT FOR USE YET',
      version: '2.1.0',
      teamId: TEAM,
      expiresAt: inDays(4),
      record: record(
        `com.kdt.livecontainer.beta.${TEAM}`,
        'com.kdt.livecontainer.beta',
        'LiveContainer - BETA NOT MEANT FOR USE YET',
        '2.1.0',
        {
          kind: 'url',
          url: 'https://example.com/com.kdt.livecontainer.beta/2.1.0/LiveContainer.ipa'
        }
      ),
      marker: {
        originalBundleId: 'com.kdt.livecontainer.beta',
        origin: {
          kind: 'url',
          url: 'https://example.com/com.kdt.livecontainer.beta/2.1.0/LiveContainer.ipa'
        },
        certificateSerial: CERTIFICATE
      }
    },
    // Installed by IPAForge on another computer: marked, but no copy kept here.
    {
      bundleId: `com.stik.stikdebug.${TEAM}`,
      name: 'StikDebug',
      version: '3.1.15',
      teamId: TEAM,
      expiresAt: inDays(7),
      marker: {
        originalBundleId: 'com.stik.stikdebug',
        origin: { kind: 'catalog', appId: 'stikdebug', channel: 'stable' },
        certificateSerial: CERTIFICATE
      }
    },
    {
      bundleId: `com.example.mygame.${TEAM}`,
      name: 'MyGame',
      version: '1.4.2',
      teamId: TEAM,
      expiresAt: inDays(8),
      marker: {
        originalBundleId: 'com.example.mygame',
        origin: { kind: 'file', name: 'MyGame.ipa' },
        certificateSerial: CERTIFICATE
      }
    },
    {
      bundleId: 'com.rileytestut.Delta',
      name: 'Delta',
      version: '1.6',
      teamId: TEAM,
      expiresAt: inDays(3)
    }
  ]
}

export const createFakeInstalled = (
  scenario: string,
  /** Apple's answer to the refresh plan (it asks for the team's certificates). */
  appleAnswer: () => Promise<void> = async () => undefined
): Pick<
  Engine,
  'installedApps' | 'removeApp' | 'installedSource' | 'refreshPlan'
> & {
  /** After a run: the apps it refreshed get a new profile (7 more days). */
  readonly refreshed: (bundleIds: readonly string[]) => void
  /** After a run: an app updated from a fake source link (`…/<original bundle id>/<version>/…`) gets that version. */
  readonly updated: (urls: readonly string[]) => void
  /** After a run: an app installed again from the catalog (marked by IPAForge elsewhere) gets 7 more days. */
  readonly reinstalled: (catalogIds: readonly string[]) => void
} => {
  let apps = seed(scenario)

  return {
    // The fake's teams aren't these ids: any team list stands for the account's.
    installedApps: async ({ teamIds }) =>
      (teamIds.length > 0 ? apps : [])
        .map((app) => ({ ...app }))
        .sort(
          (a, b) =>
            (a.expiresAt?.getTime() ?? 0) - (b.expiresAt?.getTime() ?? 0)
        ),
    removeApp: async ({ bundleId }) => {
      apps = apps.filter((app) => app.bundleId !== bundleId)
    },
    installedSource: async (_udid, bundleId) => {
      const app = apps.find((candidate) => candidate.bundleId === bundleId)

      if (!app?.record)
        throw new IPAForgeError(ErrorCode.KeptIpaMissing, {
          message: 'no kept IPA',
          data: { bundleId }
        })

      return {
        kind: 'installed',
        file: bytesFileSource(`${app.name}.ipa`, new Uint8Array([0x50, 0x4b])),
        record: app.record
      }
    },
    // The fake team's certificate is always valid: a mark naming it is enough for a new profile.
    refreshPlan: async ({ bundleIds }) => {
      await appleAnswer()

      return bundleIds.map((bundleId) =>
        apps.find((app) => app.bundleId === bundleId)?.marker
          ?.certificateSerial === CERTIFICATE
          ? { bundleId, kind: 'profile' as const }
          : {
              bundleId,
              kind: 'reinstall' as const,
              reason: 'unmarked' as const
            }
      )
    },
    refreshed: (bundleIds) => {
      apps = apps.map((app) =>
        bundleIds.includes(app.bundleId)
          ? { ...app, expiresAt: inDays(LIFETIME_DAYS) }
          : app
      )
    },
    reinstalled: (catalogIds) => {
      apps = apps.map((app) =>
        app.marker?.origin.kind === 'catalog' &&
        catalogIds.includes(app.marker.origin.appId)
          ? { ...app, expiresAt: inDays(LIFETIME_DAYS) }
          : app
      )
    },
    updated: (urls) => {
      for (const url of urls) {
        const [, bundle, version] = new URL(url).pathname.split('/')

        apps = apps.map((app) =>
          app.record?.originalBundleId === bundle && version
            ? { ...app, version, expiresAt: inDays(LIFETIME_DAYS) }
            : app
        )
      }
    }
  }
}
