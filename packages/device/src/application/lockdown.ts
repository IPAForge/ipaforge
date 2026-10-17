// Connections to lockdownd: plain (for pairing) and with a session started (for everything else).
import type { DeviceContext } from '@device/application/context.ts'
import { LOCKDOWN_PORT } from '@device/domain/constants.ts'
import { tlsCredentials } from '@device/domain/pairing/pair-record.ts'
import type { PairRecord } from '@device/domain/pairing/types.ts'
import type { UsbmuxDevice } from '@device/domain/types.ts'
import { closeOnError } from '@device/infrastructure/closeable.ts'
import { createLockdownClient } from '@device/infrastructure/lockdown/client.ts'
import type { LockdownClient } from '@device/infrastructure/lockdown/types.ts'

export type LockdownSession = {
  readonly lockdown: LockdownClient
  readonly sessionId: string
}

/** Connects to lockdownd and checks that it answers as lockdownd. */
export const openLockdown = async (
  ctx: DeviceContext,
  device: UsbmuxDevice
): Promise<LockdownClient> => {
  const link = await ctx.usbmux.connect(device.deviceId, LOCKDOWN_PORT)
  const lockdown = createLockdownClient(link, {
    label: ctx.deps.config.label,
    limits: ctx.limits,
    logger: ctx.deps.logger
  })

  return closeOnError(lockdown, async (client) => {
    await client.queryType()
    return client
  })
}

/** Connects to lockdownd and starts a session with `record`, upgrading to TLS when the device asks for it. */
export const openLockdownSession = async (
  ctx: DeviceContext,
  device: UsbmuxDevice,
  record: PairRecord
): Promise<LockdownSession> =>
  closeOnError(await openLockdown(ctx, device), async (lockdown) => {
    const { sessionId, enableSessionSsl } = await lockdown.startSession(
      record.hostId,
      record.systemBuid
    )
    if (enableSessionSsl) await lockdown.startTls(tlsCredentials(record))
    return { lockdown, sessionId }
  })
