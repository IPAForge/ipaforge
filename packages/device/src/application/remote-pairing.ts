// The remote pairing (iOS 17.4 and later) SideStore can use instead of the classic one: made once per device over
// the lockdown service the classic pairing opens, kept in the secret store, and checked with pair-verify before
// it's reused. A device that no longer accepts it (its Trust was reset) gets a new one.
import { ed25519 } from '@noble/curves/ed25519.js'

import type { DeviceContext } from '@device/application/context.ts'
import type {
  DeviceSession,
  RemotePairingOptions,
  RemotePairingResult,
  RemotePairingState
} from '@device/application/types.ts'
import { parseVersion, shortUdid } from '@device/domain/device.ts'
import { supportsRemotePairing } from '@device/domain/pairing-apps.ts'
import { REMOTE_PAIRING_SERVICE } from '@device/domain/remote-pairing/constants.ts'
import {
  parseRemotePairing,
  remotePairingSecretKey,
  serializeRemotePairing
} from '@device/domain/remote-pairing/record.ts'
import type {
  HostIdentity,
  RemotePairingRecord
} from '@device/domain/remote-pairing/types.ts'
import { withClient } from '@device/infrastructure/closeable.ts'
import { createPairingChannel } from '@device/infrastructure/remote-pairing/channel.ts'
import { pairSetup } from '@device/infrastructure/remote-pairing/pair-setup.ts'
import { pairVerify } from '@device/infrastructure/remote-pairing/pair-verify.ts'
import {
  ErrorCode,
  IPAForgeError,
  toHex,
  toIPAForgeError
} from '@ipaforge/kernel'

const randomBytes = (length: number): Uint8Array =>
  globalThis.crypto.getRandomValues(new Uint8Array(length))

/** How this computer is named on the device: IPAForge and a short tag, the same for the pairing's life. */
const HOST_NAME_PREFIX = 'IPAForge'
const HOST_MODEL = 'computer'

const uuidOf = (bytes: Uint8Array): string => {
  const hex = toHex(bytes)

  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32)
  ]
    .join('-')
    .toUpperCase()
}

/** A new identity for this computer, for one device's pairing. */
export const newHostIdentity = (): HostIdentity => {
  const privateKey = ed25519.utils.randomSecretKey()
  const identifier = uuidOf(randomBytes(16))

  return {
    identifier,
    privateKey,
    publicKey: ed25519.getPublicKey(privateKey),
    name: hostNameOf(identifier),
    model: HOST_MODEL,
    altIrk: randomBytes(16),
    mac: randomBytes(6),
    serialNumber: identifier.slice(0, 12).replaceAll('-', '')
  }
}

/** How this computer is named on the device for a pairing: the same for the pairing's life. */
export const hostNameOf = (identifier: string): string =>
  `${HOST_NAME_PREFIX}-${identifier.slice(0, 6).toLowerCase()}`

const withChannel = async <T>(
  session: DeviceSession,
  use: (channel: ReturnType<typeof createPairingChannel>) => Promise<T>
): Promise<T> =>
  withClient(
    createPairingChannel(await session.startService(REMOTE_PAIRING_SERVICE)),
    use
  )

const isRefusal = (error: unknown): boolean =>
  error instanceof IPAForgeError && error.code === ErrorCode.PairingDenied

/** The remote pairing saved for `udid`, when one was made. */
export const savedRecord = async (ctx: DeviceContext, udid: string) =>
  parseRemotePairing(await ctx.deps.secrets.get(remotePairingSecretKey(udid)))

const verify = (session: DeviceSession, record: RemotePairingRecord) =>
  withChannel(session, (channel) =>
    pairVerify(channel, {
      record,
      hostName: hostNameOf(record.identifier),
      randomBytes
    })
  )

/** Whether the device accepts the saved remote pairing; any other failure (the device went away) is thrown. */
export const checkRemotePairing = async (
  ctx: DeviceContext,
  session: DeviceSession
): Promise<RemotePairingState> => {
  const record = await savedRecord(ctx, session.device.udid)
  if (!record) return { state: 'missing' }
  const { identifier } = record
  try {
    await verify(session, record)
    return { state: 'accepted', identifier }
  } catch (error) {
    if (isRefusal(error)) return { state: 'rejected', identifier }
    throw error
  }
}

/** The saved remote pairing when the device still accepts it, else a new one (saved before it's returned). */
export const ensureRemotePairing = async (
  ctx: DeviceContext,
  session: DeviceSession,
  options: RemotePairingOptions = {}
): Promise<RemotePairingResult> => {
  const { logger, secrets } = ctx.deps
  const udid = session.device.udid
  const saved = options.forceNew ? undefined : await savedRecord(ctx, udid)

  if (saved) {
    try {
      await verify(session, saved)
      return { record: saved, how: 'verified' }
    } catch (error) {
      if (!isRefusal(error)) throw error
      logger.info(
        'the device no longer accepts the remote pairing; making a new one'
      )
    }
  }
  const host = newHostIdentity()
  const { record } = await withChannel(session, (channel) =>
    pairSetup(channel, {
      host,
      randomBytes,
      ...(options.onAwaitingConsent
        ? { onAwaitingConsent: options.onAwaitingConsent }
        : {})
    })
  )
  await secrets.set(
    remotePairingSecretKey(udid),
    serializeRemotePairing(record)
  )
  logger.info('remote pairing made', { host: host.name })

  return { record, how: 'created' }
}

/**
 * By cable, makes the remote pairing (iOS 17.4+) when none is saved, so the device can later be opened through the
 * tunnel on Wi-Fi. Best-effort: a device that would ask the user first is left alone, and it never fails the session.
 */
export const prepareRemotePairing = async (
  ctx: DeviceContext,
  session: DeviceSession
): Promise<void> => {
  const { device } = session
  const { config, logger } = ctx.deps
  if (!config.makeRemotePairing || device.connectionType !== 'usb') return
  try {
    const version = await session.getValue('ProductVersion')
    if (
      typeof version !== 'string' ||
      !supportsRemotePairing(parseVersion(version)) ||
      (await savedRecord(ctx, device.udid))
    )
      return
    await ensureRemotePairing(ctx, session, {
      onAwaitingConsent: () => {
        throw new IPAForgeError(ErrorCode.PairingDenied, {
          message: 'the device asks the user first'
        })
      }
    })
  } catch (error) {
    logger.warn('remote pairing for Wi-Fi skipped', {
      device: shortUdid(device.udid),
      code: toIPAForgeError(error).code
    })
  }
}
