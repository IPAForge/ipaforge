import type { DeviceContext } from '@device/application/context.ts'
import {
  type LockdownSession,
  openLockdownSession
} from '@device/application/lockdown.ts'
import { pairDevice } from '@device/application/pair.ts'
import type { PairOptions } from '@device/application/pair-options.ts'
import {
  getPairRecord,
  notPairedError,
  type StoredPairRecord
} from '@device/application/pair-records.ts'
import { LockdownDomain } from '@device/domain/constants.ts'
import {
  type DeviceInfo,
  shortUdid,
  type UsbmuxDevice
} from '@device/domain/device.ts'
import {
  type PairRecord,
  tlsCredentials
} from '@device/domain/pairing/pair-record.ts'
import { closeOnError } from '@device/infrastructure/closeable.ts'
import type { Link } from '@device/infrastructure/framing/link.ts'
import { toDeviceInfo } from '@device/infrastructure/lockdown/device-info.ts'
import {
  isLockdownError,
  LockdownErrorName
} from '@device/infrastructure/lockdown/errors.ts'
import { ErrorCode, LoadstarError, type PlistValue } from '@loadstar/kernel'

export type OpenSessionOptions = PairOptions & {
  /** Pair automatically (trust prompt) when there is no usable pair record. Default true. */
  readonly autoPair?: boolean
}

export type StartServiceOptions = {
  /** Send the pair record's escrow bag (needed by some services while the device is locked). */
  readonly escrowBag?: boolean
}

/** An open lockdown session with one device. Close it when done. */
export type DeviceSession = {
  readonly device: UsbmuxDevice
  readonly pairRecord: PairRecord
  info(): Promise<DeviceInfo>
  getValue(key?: string, domain?: string): Promise<PlistValue | undefined>
  setValue(domain: string, key: string, value: PlistValue): Promise<void>
  /** Starts `service` and returns a new connection to it (TLS when the device asks for it). */
  startService(service: string, options?: StartServiceOptions): Promise<Link>
  /**
   * Lets the device be reached over Wi-Fi/VPN (SideStore and StikDebug use the pairing file this way).
   * lockdownd answers `MissingValue` when no passcode is set → `device.passcode_required`.
   */
  enableWifiDebugging(): Promise<void>
  close(): Promise<void>
}

const isInvalidPairing = (error: unknown): boolean =>
  error instanceof LoadstarError && error.code === ErrorCode.InvalidPairRecord

/** The device rejected the OS's own pairing: only the user can renew it, and we must not pair over it. */
const osPairingRejected = (
  device: UsbmuxDevice,
  cause: unknown
): LoadstarError =>
  new LoadstarError(ErrorCode.InvalidPairRecord, {
    message:
      "the device rejected this computer's pairing; unplug the device, plug it back in, unlock it and tap Trust",
    cause,
    data: { source: 'usbmuxd', device: shortUdid(device.udid) }
  })

/** The stored pair record, or a new pairing when there is none (unless `autoPair` is off). */
const pairRecordFor = async (
  ctx: DeviceContext,
  device: UsbmuxDevice,
  options: OpenSessionOptions,
  autoPair: boolean
): Promise<StoredPairRecord> => {
  const stored = await getPairRecord(ctx, device.udid)
  if (stored) return stored
  if (!autoPair) throw notPairedError(device.udid)
  return pairDevice(ctx, device, options)
}

type StartedSession = LockdownSession & { readonly pairRecord: PairRecord }

const startWith = async (
  ctx: DeviceContext,
  device: UsbmuxDevice,
  record: PairRecord
): Promise<StartedSession> => ({
  ...(await openLockdownSession(ctx, device, record)),
  pairRecord: record
})

/**
 * Starts a lockdown session. When the device rejects the record, the OS's record is reported and left alone,
 * while Loadstar's own record is replaced by pairing again once (if `autoPair`).
 */
const startSession = async (
  ctx: DeviceContext,
  device: UsbmuxDevice,
  options: OpenSessionOptions,
  autoPair: boolean
): Promise<StartedSession> => {
  const stored = await pairRecordFor(ctx, device, options, autoPair)
  try {
    return await startWith(ctx, device, stored.record)
  } catch (error) {
    if (!isInvalidPairing(error)) throw error
    if (stored.source === 'usbmuxd') throw osPairingRejected(device, error)
    if (!autoPair) throw error
    ctx.deps.logger.warn('the device rejected our pair record; pairing again', {
      device: shortUdid(device.udid)
    })
    const repaired = await pairDevice(ctx, device, options)

    return startWith(ctx, device, repaired.record)
  }
}

/** The `DeviceSession` over a started lockdown session. */
const sessionFor = (
  ctx: DeviceContext,
  device: UsbmuxDevice,
  pairRecord: PairRecord,
  { lockdown, sessionId }: LockdownSession
): DeviceSession => {
  const { logger } = ctx.deps
  const credentials = tlsCredentials(pairRecord)
  let closed = false

  const startService = async (
    service: string,
    options: StartServiceOptions = {}
  ): Promise<Link> => {
    const escrowBag = options.escrowBag ? pairRecord.escrowBag : undefined
    const { port, enableServiceSsl } = await lockdown.startService(
      service,
      escrowBag
    )

    return closeOnError(
      await ctx.usbmux.connect(device.deviceId, port),
      async (link) => {
        if (enableServiceSsl) await link.startTls(credentials)
        return link
      }
    )
  }

  const enableWifiDebugging = async (): Promise<void> => {
    try {
      await lockdown.setValue(
        LockdownDomain.WirelessLockdown,
        'EnableWifiDebugging',
        true
      )
    } catch (error) {
      if (isLockdownError(error, LockdownErrorName.MissingValue)) {
        throw new LoadstarError(ErrorCode.PasscodeRequired, { cause: error })
      }
      throw error
    }
  }

  const close = async (): Promise<void> => {
    if (closed) return
    closed = true
    try {
      await lockdown.stopSession(sessionId)
    } catch (error) {
      logger.debug('StopSession failed (ignored)', { cause: error })
    } finally {
      await lockdown.close()
      logger.info('session closed', { device: shortUdid(device.udid) })
    }
  }

  return {
    device,
    pairRecord,
    info: async () => toDeviceInfo(await lockdown.getValue()),
    getValue: (key, domain) => lockdown.getValue(key, domain),
    setValue: (domain, key, value) => lockdown.setValue(domain, key, value),
    startService,
    enableWifiDebugging,
    close
  }
}

/**
 * Opens a lockdown session. A missing pair record, or a rejected one of Loadstar's own, triggers pairing (once)
 * unless `autoPair` is false, in which case `device.not_paired` / `device.invalid_pair_record` is thrown.
 * A rejected OS record always throws `device.invalid_pair_record` with `data.source: "usbmuxd"`.
 */
export const openSession = async (
  ctx: DeviceContext,
  device: UsbmuxDevice,
  options: OpenSessionOptions = {}
): Promise<DeviceSession> => {
  const { pairRecord, ...started } = await startSession(
    ctx,
    device,
    options,
    options.autoPair ?? true
  )
  ctx.deps.logger.info('session opened', { device: shortUdid(device.udid) })
  return sessionFor(ctx, device, pairRecord, started)
}
