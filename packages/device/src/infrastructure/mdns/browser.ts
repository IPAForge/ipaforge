// Finding devices on the local network: asks for `_apple-mobdev2._tcp` (lockdown over Wi-Fi) now and every
// interval, from a port of its own so answers come straight back to it (RFC 6762 §6.7), and turns the records into
// adverts: the instance, the IPv4 address, the MAC address in its name, and the identifier and authTags of its TXT.
// An advert withdrawn (a goodbye) or not heard from for three rounds is lost.
import type { MulticastSocket } from '@device/domain/ports/types.ts'
import { macOfInstance } from '@device/domain/wifi.ts'
import {
  RecordType,
  WIFI_LOCKDOWN_SERVICE
} from '@device/infrastructure/mdns/constants.ts'
import {
  decodeMessage,
  encodeQuery
} from '@device/infrastructure/mdns/message.ts'
import type {
  BrowseEvent,
  BrowseOptions,
  PendingAdvert,
  ResourceRecord,
  WifiAdvert
} from '@device/infrastructure/mdns/types.ts'
import { ErrorCode, IPAForgeError, toIPAForgeError } from '@ipaforge/kernel'

const ROUNDS_BEFORE_LOST = 3

const txtValues = (entries: readonly string[], key: string): string[] =>
  entries
    .filter((entry) => entry.startsWith(`${key}=`))
    .map((entry) => entry.slice(key.length + 1))

const sameAdvert = (a: WifiAdvert, b: WifiAdvert): boolean =>
  a.address === b.address &&
  a.port === b.port &&
  a.identifier === b.identifier &&
  a.authTags.join() === b.authTags.join()

export const browseWifiDevices = (
  socket: MulticastSocket,
  options: BrowseOptions,
  onEvent: (event: BrowseEvent) => void,
  signal: AbortSignal
): Promise<void> =>
  browseService(socket, WIFI_LOCKDOWN_SERVICE, options, onEvent, signal)

/** The same search for any DNS-SD service type (`_remotepairing._tcp.local` for the remote pairing tunnel). */
export const browseService = async (
  socket: MulticastSocket,
  service: string,
  { sleep, now, intervalMs, logger }: BrowseOptions,
  onEvent: (event: BrowseEvent) => void,
  signal: AbortSignal
): Promise<void> => {
  const partials = new Map<string, PendingAdvert>()
  const hosts = new Map<string, string>()
  const adverts = new Map<string, { advert: WifiAdvert; seenAt: number }>()
  let queryId = globalThis.crypto.getRandomValues(new Uint16Array(1))[0] ?? 0

  const send = async (questions: Parameters<typeof encodeQuery>[0]) => {
    queryId = (queryId + 1) & 0xff_ff
    try {
      await socket.send(encodeQuery(questions, queryId))
    } catch (error) {
      // Refused local network access is the caller's to report; anything else is retried next round.
      if (
        error instanceof IPAForgeError &&
        error.code === ErrorCode.LocalNetworkDenied
      )
        throw error
      logger.debug('mDNS query not sent', { code: toIPAForgeError(error).code })
    }
  }

  const lose = (instance: string) => {
    partials.delete(instance)
    if (adverts.delete(instance)) onEvent({ kind: 'lost', instance })
  }

  const settle = (instance: string, partial: PendingAdvert) => {
    const address = partial.host ? hosts.get(partial.host) : undefined
    if (!address) return false
    const advert: WifiAdvert = {
      instance,
      address,
      port: partial.port,
      mac: macOfInstance(instance),
      identifier: partial.identifier,
      authTags: partial.authTags
    }
    const known = adverts.get(instance)
    adverts.set(instance, { advert, seenAt: now() })
    if (!known || !sameAdvert(known.advert, advert))
      onEvent({ kind: 'found', advert })
    return true
  }

  const take = (record: ResourceRecord) => {
    if (record.type === RecordType.PTR && record.name === service) {
      if (record.ttl === 0) lose(record.target)
      else if (!partials.has(record.target))
        partials.set(record.target, { authTags: [] })
      return
    }
    if (record.type === RecordType.A) {
      if (record.ttl > 0) hosts.set(record.name, record.address)
      return
    }
    const partial = partials.get(record.name)
    if (!partial) return
    if (record.type === RecordType.SRV) {
      partial.host = record.target
      partial.port = record.port
    }
    if (record.type === RecordType.TXT) {
      partial.identifier = txtValues(record.entries, 'identifier')[0]
      partial.authTags = txtValues(record.entries, 'authTag')
    }
  }

  const onMessage = (bytes: Uint8Array) => {
    let records: readonly ResourceRecord[]
    try {
      const message = decodeMessage(bytes)
      if (!message.isResponse) return
      records = message.records
    } catch (error) {
      logger.debug('mDNS answer skipped', { code: toIPAForgeError(error).code })
      return
    }
    for (const record of records) take(record)
    for (const [instance, partial] of partials) {
      if (settle(instance, partial)) continue
      // The answer named the device but not where it is: ask for that next.
      void send([
        { name: instance, type: RecordType.SRV },
        { name: instance, type: RecordType.TXT },
        ...(partial.host ? [{ name: partial.host, type: RecordType.A }] : [])
      ]).catch(() => undefined)
    }
  }

  const stop = socket.onMessage(({ bytes }) => onMessage(bytes))
  try {
    while (!signal.aborted) {
      await send([{ name: service, type: RecordType.PTR }])
      try {
        await sleep(intervalMs, signal)
      } catch {
        return
      }
      const cutoff = now() - ROUNDS_BEFORE_LOST * intervalMs
      for (const [instance, { seenAt }] of adverts)
        if (seenAt < cutoff) lose(instance)
    }
  } finally {
    stop()
  }
}
