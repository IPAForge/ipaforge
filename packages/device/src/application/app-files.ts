// Files inside an app's container (house_arrest + AFC): write, read and check them.
import type { DeviceContext } from '@device/application/context.ts'
import { openAppContainer } from '@device/application/services.ts'
import type {
  AppFileStatus,
  AppFileTarget,
  DeviceSession
} from '@device/application/types.ts'
import { shortUdid } from '@device/domain/device.ts'
import type { AfcClient, AfcStat } from '@device/infrastructure/afc/types.ts'
import { withClient } from '@device/infrastructure/closeable.ts'
import { compact, ErrorCode, LoadstarError } from '@loadstar/kernel'

const RETRY_DELAY_MS = 500
const NS_PER_MS = 1e6

const parentOf = (path: string): string | undefined => {
  const slash = path.lastIndexOf('/')

  return slash > 0 ? path.slice(0, slash) : undefined
}

/** AFC over house_arrest drops occasionally (device locked, afcd hiccups): retry once after a short pause. */
const isTransient = (error: unknown): boolean =>
  error instanceof LoadstarError &&
  (error.code === ErrorCode.DeviceDisconnected ||
    error.code === ErrorCode.AfcError)

const withRetry = async <T>(
  ctx: DeviceContext,
  run: () => Promise<T>
): Promise<T> => {
  try {
    return await run()
  } catch (error) {
    if (!isTransient(error)) throw error
    ctx.deps.logger.warn('app container access failed; retrying once', {
      cause: error
    })
    await ctx.deps.sleep(RETRY_DELAY_MS)
    return run()
  }
}

/** Runs `use` on the target app's container, retrying once on a transient failure. */
const withAppContainer = <T>(
  ctx: DeviceContext,
  session: DeviceSession,
  target: AppFileTarget,
  use: (afc: AfcClient) => Promise<T>
): Promise<T> =>
  withRetry(ctx, async () =>
    withClient(
      await openAppContainer(
        ctx,
        session,
        target.bundleId,
        target.mode ?? 'documents'
      ),
      use
    )
  )

const ensureParentDir = async (afc: AfcClient, path: string): Promise<void> => {
  const parent = parentOf(path)
  if (parent && !(await afc.exists(parent))) await afc.mkdir(parent)
}

const verifySize = async (
  afc: AfcClient,
  target: AppFileTarget,
  expected: number
): Promise<void> => {
  const written = await afc.stat(target.path)
  if (written.size === expected) return
  throw new LoadstarError(ErrorCode.AfcError, {
    message: `wrote ${expected} bytes but the device has ${written.size}`,
    data: { bundleId: target.bundleId, path: target.path }
  })
}

/** `st_mtime` (nanoseconds) as a date, when the device reports a usable one. */
const modifiedAtOf = (stat: AfcStat): Date | undefined => {
  const mtimeNs = stat.raw.st_mtime ? Number(stat.raw.st_mtime) : Number.NaN

  return Number.isFinite(mtimeNs) ? new Date(mtimeNs / NS_PER_MS) : undefined
}

const statusOf = async (
  afc: AfcClient,
  target: AppFileTarget
): Promise<AppFileStatus> => {
  if (!(await afc.exists(target.path))) return { target, exists: false }
  const stat = await afc.stat(target.path)

  return compact({
    target,
    exists: true,
    size: stat.size,
    modifiedAt: modifiedAtOf(stat)
  })
}

/** Writes `data` into an app's container (creating parent folders) and checks the size that landed. */
export const writeAppFile = (
  ctx: DeviceContext,
  session: DeviceSession,
  target: AppFileTarget,
  data: Uint8Array
): Promise<void> =>
  withAppContainer(ctx, session, target, async (afc) => {
    await ensureParentDir(afc, target.path)
    await afc.writeFile(target.path, data)
    await verifySize(afc, target, data.byteLength)
    ctx.deps.logger.info('wrote app file', {
      device: shortUdid(session.device.udid),
      bundleId: target.bundleId,
      path: target.path,
      bytes: data.byteLength
    })
  })

export const readAppFile = (
  ctx: DeviceContext,
  session: DeviceSession,
  target: AppFileTarget
): Promise<Uint8Array> =>
  withAppContainer(ctx, session, target, (afc) => afc.readFile(target.path))

/** Whether each target file exists, with size and modification time. */
export const appFileStatus = async (
  ctx: DeviceContext,
  session: DeviceSession,
  targets: readonly AppFileTarget[]
): Promise<AppFileStatus[]> => {
  const statuses: AppFileStatus[] = []
  for (const target of targets)
    statuses.push(
      await withAppContainer(ctx, session, target, (afc) =>
        statusOf(afc, target)
      )
    )
  return statuses
}
