import type { DeviceContext } from '@device/application/context.ts'
import { createServiceRouter } from '@device/application/device-link.ts'
import {
  type LockdownSession,
  openLockdownSession
} from '@device/application/lockdown.ts'
import { pairDevice } from '@device/application/pair.ts'
import {
  getPairRecord,
  notPairedError
} from '@device/application/pair-records.ts'
import type {
  DeviceSession,
  OpenSessionOptions,
  StartedSession,
  StoredPairRecord
} from '@device/application/types.ts'
import { prepareWifi } from '@device/application/wifi.ts'
import { LockdownDomain } from '@device/domain/constants.ts'
import { shortUdid } from '@device/domain/device.ts'
import type { PairRecord } from '@device/domain/pairing/types.ts'
import type { UsbmuxDevice } from '@device/domain/types.ts'
import { LockdownErrorName } from '@device/infrastructure/lockdown/constants.ts'
import { toDeviceInfo } from '@device/infrastructure/lockdown/device-info.ts'
import { isLockdownError } from '@device/infrastructure/lockdown/errors.ts'
import { ErrorCode, IPAForgeError } from '@ipaforge/kernel'

const isInvalidPairing = (error: unknown): boolean =>
  error instanceof IPAForgeError && error.code === ErrorCode.InvalidPairRecord

/** The device rejected the OS's own pairing: only the user can renew it, and we must not pair over it. */
const osPairingRejected = (
  device: UsbmuxDevice,
  cause: unknown
): IPAForgeError =>
  new IPAForgeError(ErrorCode.InvalidPairRecord, {
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
 * while IPAForge's own record is replaced by pairing again once (if `autoPair`).
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
  { lockdown, sessionId }: LockdownSession,
  route: OpenSessionOptions['route']
): DeviceSession => {
  const { logger } = ctx.deps
  const services = createServiceRouter(
    ctx,
    device,
    { lockdown, pairRecord },
    route === 'tunnel' ? 'tunnel' : 'fallback'
  )
  let closed = false

  const enableWifiDebugging = async (): Promise<void> => {
    try {
      await lockdown.setValue(
        LockdownDomain.WirelessLockdown,
        'EnableWifiDebugging',
        true
      )
    } catch (error) {
      if (isLockdownError(error, LockdownErrorName.MissingValue)) {
        throw new IPAForgeError(ErrorCode.PasscodeRequired, { cause: error })
      }
      throw error
    }
  }

  const close = async (): Promise<void> => {
    if (closed) return
    closed = true
    await services.close().catch((error: unknown) => {
      logger.debug('closing the tunnel failed (ignored)', { cause: error })
    })
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
    startService: services.startService,
    tunnel: services.tunnel,
    enableWifiDebugging,
    close
  }
}

/**
 * Opens a lockdown session. A missing pair record, or a rejected one of IPAForge's own, triggers pairing (once)
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
  await prepareWifi(ctx, device, started.lockdown)
  return sessionFor(ctx, device, pairRecord, started, options.route)
}
