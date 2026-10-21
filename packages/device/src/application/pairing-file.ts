// The pairing file on-device tools (SideStore, StikDebug, …) use to reach lockdownd: where it goes and placing it.
// On iOS 17.4 and later SideStore also gets its remote pairing, in a file of its own; failing to make that one
// leaves the classic pairing in place (SideStore works with it alone).
import { writeAppFile } from '@device/application/app-files.ts'
import { installedBundleIds } from '@device/application/apps.ts'
import type { DeviceContext } from '@device/application/context.ts'
import { ensureRemotePairing } from '@device/application/remote-pairing.ts'
import type {
  AppFileTarget,
  DeviceSession,
  PairingTarget,
  PlacedPairing,
  PlacePairingOptions
} from '@device/application/types.ts'
import { LOCKDOWN_WIFI_ADDRESS_KEY } from '@device/domain/constants.ts'
import { parseVersion } from '@device/domain/device.ts'
import { pairingFile } from '@device/domain/pairing/pair-record.ts'
import type { PairRecord } from '@device/domain/pairing/types.ts'
import {
  findPairingApps,
  remotePairingTargets,
  supportsRemotePairing
} from '@device/domain/pairing-apps.ts'
import { remotePairingFile } from '@device/domain/remote-pairing/record.ts'
import { compact } from '@ipaforge/kernel'

/** Pairing-file locations of the known pairing apps installed on the device (sideloaded copies only from `teamIds`). */
export const pairingTargets = async (
  ctx: DeviceContext,
  session: DeviceSession,
  teamIds: Iterable<string>
): Promise<PairingTarget[]> =>
  findPairingApps(await installedBundleIds(ctx, session), { teamIds }).flatMap(
    ({ app, bundleId }) =>
      app.files.map((path) => ({ bundleId, path, appName: app.name }))
  )

/** The session's pair record with its Wi-Fi MAC address, read from the device when the record lacks it. */
const withWifiMacAddress = async (
  session: DeviceSession
): Promise<PairRecord> => {
  if (session.pairRecord.wifiMacAddress) return session.pairRecord
  const wifiMacAddress = await session.getValue(LOCKDOWN_WIFI_ADDRESS_KEY)

  return typeof wifiMacAddress === 'string'
    ? { ...session.pairRecord, wifiMacAddress }
    : session.pairRecord
}

/** The remote pairing written to `targets`, or undefined when there are none, the iOS is older, or it failed. */
const placeRemotePairing = async (
  ctx: DeviceContext,
  session: DeviceSession,
  targets: readonly AppFileTarget[],
  options: PlacePairingOptions
): Promise<Omit<PlacedPairing, 'classic'>> => {
  if (targets.length === 0 || options.remotePairing === false)
    return { remote: [] }
  const { productVersion } = await session.info()
  if (!supportsRemotePairing(parseVersion(productVersion ?? '0')))
    return { remote: [] }
  try {
    const { record, how } = await ensureRemotePairing(
      ctx,
      session,
      compact({
        onAwaitingConsent: options.onAwaitingConsent,
        forceNew: options.newRemotePairing
      })
    )
    const data = remotePairingFile(record)
    for (const target of targets) await writeAppFile(ctx, session, target, data)

    return { remote: targets, remoteHow: how }
  } catch (error) {
    ctx.deps.logger.warn(
      'remote pairing not placed; SideStore keeps the classic pairing',
      { error }
    )
    return { remote: [] }
  }
}

/** This host's pairing file for the device (pair record, Wi-Fi MAC address and UDID), as on-device tools read it. */
export const pairingFileData = async (
  session: DeviceSession
): Promise<Uint8Array> =>
  pairingFile(await withWifiMacAddress(session), session.device.udid)

/**
 * Places this host's pairing file (pair record + UDID) at each target, verifying every write, and on iOS 17.4 and
 * later SideStore's remote pairing next to it.
 */
export const placePairingFile = async (
  ctx: DeviceContext,
  session: DeviceSession,
  targets: readonly AppFileTarget[],
  options: PlacePairingOptions = {}
): Promise<PlacedPairing> => {
  if (options.enableWifiDebugging ?? true) await session.enableWifiDebugging()
  const data = await pairingFileData(session)
  for (const target of targets) await writeAppFile(ctx, session, target, data)

  return {
    classic: targets,
    ...(await placeRemotePairing(
      ctx,
      session,
      remotePairingTargets(targets),
      options
    ))
  }
}
