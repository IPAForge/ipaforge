// Pairing files for the fake Engine: SideStore with this computer's files, StikDebug with another computer's,
// LiveContainer with none (its row says so), and two apps of the user's own, one with a pairing file placed.
import { ErrorCode, IPAForgeError } from '@ipaforge/kernel'
import type { Engine } from '@ipaforge/rpc'
import { isPairingPath } from '@ui/features/apps/utils/is-pairing-path.ts'
import type { AppPairing } from '@ui/services/engine/types.ts'

const TEAM = 'FAKETEAM01'
type PairingQueries = Pick<
  Engine,
  | 'pairingFiles'
  | 'placeAppPairing'
  | 'removeAppPairing'
  | 'newRemotePairing'
  | 'devicePairingFile'
>

const seed = (): AppPairing[] => [
  {
    bundleId: `com.SideStore.SideStore.${TEAM}`,
    name: 'SideStore',
    kind: 'known',
    classic: 'this-computer',
    placedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    remote: 'accepted'
  },
  {
    bundleId: `com.kdt.livecontainer.beta.${TEAM}`,
    name: 'LiveContainer - BETA NOT MEANT FOR USE YET',
    kind: 'known',
    classic: 'missing',
    remote: 'missing'
  },
  {
    bundleId: `com.stik.stikdebug.${TEAM}`,
    name: 'StikDebug',
    kind: 'known',
    classic: 'other-computer'
  },
  {
    bundleId: `com.google.ios.youtube.${TEAM}`,
    name: 'YouTube',
    kind: 'own',
    classic: 'this-computer',
    path: 'Documents/pairingFile.plist'
  },
  {
    bundleId: `com.example.mygame.${TEAM}`,
    name: 'MyGame',
    kind: 'own',
    classic: 'missing'
  }
]

export const createFakePairing = (
  wait: () => Promise<void>
): PairingQueries => {
  let apps = seed()
  const update = (
    bundleId: string,
    change: (app: AppPairing) => AppPairing
  ) => {
    if (!apps.some((app) => app.bundleId === bundleId))
      throw new IPAForgeError(ErrorCode.PairingAppNotFound)
    apps = apps.map((app) => (app.bundleId === bundleId ? change(app) : app))
  }

  return {
    pairingFiles: async () => apps,
    placeAppPairing: async ({ bundleId, path }) => {
      if (path !== undefined && !isPairingPath(path))
        throw new IPAForgeError(ErrorCode.PairingPathInvalid)
      await wait()
      update(bundleId, (app) => ({
        ...app,
        classic: 'this-computer',
        placedAt: new Date(),
        ...(app.remote === undefined ? {} : { remote: 'accepted' as const }),
        ...(app.kind === 'own'
          ? { path: path ?? app.path ?? 'Documents/pairingFile.plist' }
          : {})
      }))
    },
    removeAppPairing: async ({ bundleId }) => {
      await wait()
      update(bundleId, ({ placedAt: _, path: __, ...app }) => ({
        ...app,
        classic: 'missing',
        ...(app.remote === undefined ? {} : { remote: 'missing' as const })
      }))
    },
    newRemotePairing: async () => {
      await wait()
      apps = apps.map((app) =>
        app.remote === undefined ? app : { ...app, remote: 'accepted' }
      )
    },
    devicePairingFile: async (udid) =>
      `<?xml version="1.0" encoding="UTF-8"?>\n<plist version="1.0"><dict><key>UDID</key><string>${udid}</string></dict></plist>\n`
  }
}
