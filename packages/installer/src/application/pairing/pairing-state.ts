// Whose pairing files an app holds: the classic one (by the host id this computer pairs with) and, on iOS 17.4 and
// later, the remote one (this computer's saved remote pairing, and whether the device still accepts it).

import type {
  ClassicPairingState,
  RemotePairingFileState
} from '@installer/domain/types.ts'
import {
  type AppFileTarget,
  type DeviceHandle,
  parseVersion,
  supportsRemotePairing
} from '@ipaforge/device'
import { compact, isPlistDict, parsePlist, stringAt } from '@ipaforge/kernel'

/** The first of `targets` that exists, read: whose it is and when it was written. */
export const classicPairingOf = async (
  handle: DeviceHandle,
  targets: readonly AppFileTarget[]
): Promise<{
  readonly state: ClassicPairingState
  readonly placedAt?: Date
}> => {
  const [first] = (await handle.appFileStatus(targets)).filter(
    (status) => status.exists
  )

  if (!first) return { state: 'missing' }

  const file = parsePlist(await handle.readAppFile(first.target))
  const hostId = isPlistDict(file) ? stringAt(file, 'HostID') : undefined
  const state: ClassicPairingState =
    hostId?.toUpperCase() === handle.pairRecord.hostId.toUpperCase()
      ? 'this-computer'
      : 'other-computer'

  return compact({ state, placedAt: first.modifiedAt })
}

/** Whether the device's iOS uses remote pairing files (17.4 and later). */
export const usesRemotePairing = (iosVersion: string | undefined): boolean =>
  supportsRemotePairing(parseVersion(iosVersion ?? '0'))

/** The first of `targets` that exists: this computer's remote pairing (accepted or not), another's, or none. */
export const remotePairingOf = async (
  handle: DeviceHandle,
  targets: readonly AppFileTarget[]
): Promise<RemotePairingFileState> => {
  const [present] = (await handle.appFileStatus(targets)).filter(
    (status) => status.exists
  )

  if (!present) return 'missing'

  const file = parsePlist(await handle.readAppFile(present.target))
  const identifier = isPlistDict(file)
    ? stringAt(file, 'identifier')
    : undefined
  const saved = await handle.checkRemotePairing()

  if (saved.state === 'missing' || saved.identifier !== identifier)
    return 'other-computer'

  return saved.state
}
