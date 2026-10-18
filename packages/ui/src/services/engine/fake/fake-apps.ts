// What the fake Engine knows about the apps the Preload page adds: a catalog app by its id, a picked file or a link
// by its name. A name with "Encrypted" in it plays an App Store app, "Future" one that needs a newer iOS, and
// "NotAnApp" a file that isn't one; StikDebug is already on the device in an older version.
import { ErrorCode, IPAForgeError } from '@ipaforge/kernel'
import type { FakeApp, FakeAppSource } from '@ui/services/engine/fake/types.ts'

const CATALOG: Readonly<Record<string, FakeApp>> = {
  sidestore: {
    name: 'SideStore',
    version: '0.7.0',
    extensions: 1,
    isCatalog: true
  },
  'livecontainer-sidestore': {
    name: 'LiveContainer + SideStore',
    version: '3.8.0',
    extensions: 4,
    isCatalog: true
  },
  livecontainer: {
    name: 'LiveContainer',
    version: '3.8.0',
    extensions: 3,
    isCatalog: true
  },
  stikdebug: {
    name: 'StikDebug',
    version: '3.1.15',
    extensions: 0,
    isCatalog: true,
    installedVersion: '3.1.10'
  },
  feather: { name: 'Feather', version: '2.9.0', extensions: 0, isCatalog: true }
}

/** The app a source holds, or the error the real Engine would give reading it. */
export const fakeAppFor = (source: FakeAppSource): FakeApp => {
  if (source.kind === 'catalog') {
    const app = CATALOG[source.appId]
    if (!app)
      throw new IPAForgeError(ErrorCode.ReleaseSourceGone, {
        data: { appId: source.appId }
      })
    return app
  }
  const { name } = source.file
  if (name.includes('NotAnApp'))
    throw new IPAForgeError(ErrorCode.InvalidBundle, { data: { name } })
  if (name.includes('Encrypted'))
    throw new IPAForgeError(ErrorCode.EncryptedBinary, { data: { name } })
  return {
    name: name.replace(/\.ipa$/i, '') || 'App',
    version: '1.0',
    extensions: name.includes('Widget') ? 1 : 0,
    isCatalog: false,
    needsIos: name.includes('Future') ? '27.0' : undefined
  }
}

/** The plan the fake Engine gives an app: its name and version, App IDs, slots, and what keeps it off the device. */
export const fakePlanFor = (
  app: FakeApp,
  team: unknown,
  iosVersion: string
) => {
  const bundleId = `com.example.${app.name.toLowerCase().replace(/[^a-z0-9]+/g, '')}`
  const ids = [
    bundleId,
    ...Array.from({ length: app.extensions }, (_, n) => `${bundleId}.ext${n}`)
  ]

  return {
    team,
    inspection: {
      app: {
        path: `Payload/${app.name}.app`,
        identifier: bundleId,
        name: app.name,
        version: app.version,
        deviceFamilies: [1, 2],
        architectures: ['arm64']
      },
      nested: ids.slice(1).map((identifier, n) => ({
        path: `PlugIns/Ext${n}.appex`,
        kind: 'appex',
        identifier,
        name: `Ext${n}`
      })),
      appGroups: [],
      keychainAccessGroups: [],
      altAppGroups: []
    },
    ...(app.needsIos
      ? {
          compatibility: {
            code: ErrorCode.UnsupportedIos,
            data: { minimumOSVersion: app.needsIos, iosVersion }
          }
        }
      : {}),
    identity: { newMainBundleId: `${bundleId}.TEAM` },
    ...(app.installedVersion ? { installedVersion: app.installedVersion } : {}),
    appIds: {
      reuse: app.installedVersion ? ids : [],
      create: app.installedVersion ? [] : ids,
      available: 8,
      enough: true,
      nextSlotAt: new Date('2026-10-19T00:00:00Z')
    },
    freeSlots: { occupied: [{ bundleId: 'com.example.other' }], limit: 3 },
    certificate: { stored: true, reusable: true, onTeam: 1 },
    sharesCertificate: app.name.includes('SideStore')
  }
}
