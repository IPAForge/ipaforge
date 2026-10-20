// Apps that read a lockdown pairing file from their Documents folder, and the exact file names each expects.
// Data, not code: add an app by adding an entry.
//
// A pairing file carries a host private key: whoever holds it can drive the device's lockdown services. So an
// installed app only matches as itself (the original bundle ID, which no other team can register) or as a copy
// sideloaded by one of the user's own teams (`<original>.<TEAMID>`). Callers still confirm targets with the user.
import type {
  FindPairingAppsOptions,
  PairingApp,
  PairingAppMatch
} from '@device/domain/types.ts'

export const PAIRING_APPS: readonly PairingApp[] = [
  {
    id: 'sidestore',
    name: 'SideStore',
    bundleId: 'com.SideStore.SideStore',
    // Current builds read PairingFile_Lockdown.plist; older builds read (and newer ones migrate) the legacy name.
    files: [
      'Documents/PairingFile_Lockdown.plist',
      'Documents/ALTPairingFile.mobiledevicepairing'
    ],
    remoteFiles: ['Documents/PairingFile_RemoteRP.plist']
  },
  {
    id: 'livecontainer',
    name: 'LiveContainer + SideStore',
    bundleId: 'com.kdt.livecontainer',
    // SideStore runs inside LiveContainer with its own Documents folder.
    files: [
      'Documents/SideStore/Documents/PairingFile_Lockdown.plist',
      'Documents/SideStore/Documents/ALTPairingFile.mobiledevicepairing'
    ],
    remoteFiles: ['Documents/SideStore/Documents/PairingFile_RemoteRP.plist']
  },
  {
    id: 'stikdebug',
    name: 'StikDebug',
    bundleId: 'com.stik.stikdebug',
    files: ['Documents/pairingFile.plist']
  },
  {
    id: 'stikstore',
    name: 'StikStore',
    bundleId: 'app.stik.store',
    files: ['Documents/pairingFile.plist']
  }
]

/** iOS 17.4, the first with remote pairing over the lockdown service. */
const REMOTE_PAIRING_MIN_IOS = [17, 4] as const

export const supportsRemotePairing = (
  version: readonly [number, number, number]
): boolean => {
  const [major, minor] = version
  const [minMajor, minMinor] = REMOTE_PAIRING_MIN_IOS

  return major > minMajor || (major === minMajor && minor >= minMinor)
}

/**
 * The remote pairing files to write next to classic pairing `targets`: for each target that is one of an app's
 * classic files, that app's remote files, once each.
 */
export const remotePairingTargets = <
  T extends { bundleId: string; path: string }
>(
  targets: readonly T[],
  apps: readonly PairingApp[] = PAIRING_APPS
): { bundleId: string; path: string }[] => {
  const found = new Map<string, { bundleId: string; path: string }>()
  for (const target of targets) {
    const app = apps.find((candidate) => candidate.files.includes(target.path))
    for (const path of app?.remoteFiles ?? [])
      found.set(`${target.bundleId}/${path}`, {
        bundleId: target.bundleId,
        path
      })
  }
  return [...found.values()]
}

/** True when `installed` is `original`, or `original.<TEAMID>` for one of `teamIds` (the user's own teams). */
export const matchesBundleId = (
  installed: string,
  original: string,
  teamIds: ReadonlySet<string>
): boolean =>
  installed === original ||
  (installed.startsWith(`${original}.`) &&
    teamIds.has(installed.slice(original.length + 1)))

/** The pairing apps among `installedBundleIds`. */
export const findPairingApps = (
  installedBundleIds: Iterable<string>,
  options: FindPairingAppsOptions
): PairingAppMatch[] => {
  const teamIds = new Set(options.teamIds)
  const apps = options.apps ?? PAIRING_APPS
  const matches: PairingAppMatch[] = []
  for (const bundleId of installedBundleIds) {
    const app = apps.find((candidate) =>
      matchesBundleId(bundleId, candidate.bundleId, teamIds)
    )
    if (app) matches.push({ app, bundleId })
  }
  return matches
}
