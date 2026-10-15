// Where pair records live: usbmuxd (the OS's own record, read only) first, Loadstar's secret store as the fallback.
import type { DeviceContext } from '@device/application/context.ts'
import { shortUdid } from '@device/domain/device.ts'
import {
  type PairRecord,
  parsePairRecord,
  serializePairRecord
} from '@device/domain/pairing/pair-record.ts'
import { ErrorCode, LoadstarError } from '@loadstar/kernel'

/** Where a pair record comes from: the OS's usbmuxd, or Loadstar's own secret store. */
export type PairRecordStore = 'usbmuxd' | 'secret_store'

/** A pair record and where it was found. */
export type StoredPairRecord = {
  readonly record: PairRecord
  readonly source: PairRecordStore
}

/** Key under which Loadstar keeps a pair record of its own. */
export const pairRecordSecretKey = (udid: string): string =>
  `pair-record/${udid}`

export const notPairedError = (udid: string): LoadstarError =>
  new LoadstarError(ErrorCode.DeviceNotPaired, {
    data: { device: shortUdid(udid) }
  })

/** The record the OS keeps in usbmuxd once the user has tapped Trust; `undefined` while there is none. */
export const readOsPairRecord = async (
  ctx: DeviceContext,
  udid: string
): Promise<PairRecord | undefined> => {
  const bytes = await ctx.usbmux.readPairRecord(udid)

  return bytes ? parsePairRecord(bytes, ctx.deps.config.plist) : undefined
}

const readOwnPairRecord = async (
  ctx: DeviceContext,
  udid: string
): Promise<PairRecord | undefined> => {
  const bytes = await ctx.deps.secrets.get(pairRecordSecretKey(udid))

  return bytes ? parsePairRecord(bytes, ctx.deps.config.plist) : undefined
}

/** The pair record for `udid`: usbmuxd's (the OS trusts this host) first, then Loadstar's own one. */
export const getPairRecord = async (
  ctx: DeviceContext,
  udid: string
): Promise<StoredPairRecord | undefined> => {
  const { logger } = ctx.deps
  const fromOs = await readOsPairRecord(ctx, udid)
  if (fromOs) {
    logger.debug('pair record from usbmuxd', { device: shortUdid(udid) })
    return { record: fromOs, source: 'usbmuxd' }
  }
  const own = await readOwnPairRecord(ctx, udid)
  if (!own) return undefined
  logger.debug('pair record from the secret store', { device: shortUdid(udid) })
  return { record: own, source: 'secret_store' }
}

/** Like `getPairRecord`, but throws `device.not_paired` when there is none. */
export const requirePairRecord = async (
  ctx: DeviceContext,
  udid: string
): Promise<PairRecord> => {
  const stored = await getPairRecord(ctx, udid)
  if (!stored) throw notPairedError(udid)
  return stored.record
}

/** Keeps a pair record Loadstar made itself. It only ever goes to the secret store, never over the OS's record. */
export const saveOwnPairRecord = (
  ctx: DeviceContext,
  udid: string,
  record: PairRecord
): Promise<void> =>
  ctx.deps.secrets.set(pairRecordSecretKey(udid), serializePairRecord(record))

/** Exports a pair record as plist bytes (for backups or other hosts). */
export const exportPairRecord = (record: PairRecord): Uint8Array =>
  serializePairRecord(record)

/** Imports a pair record from plist bytes into Loadstar's own store. */
export const importPairRecord = async (
  ctx: DeviceContext,
  udid: string,
  data: Uint8Array
): Promise<PairRecord> => {
  const record = parsePairRecord(data, ctx.deps.config.plist)
  await saveOwnPairRecord(ctx, udid, record)
  return record
}
