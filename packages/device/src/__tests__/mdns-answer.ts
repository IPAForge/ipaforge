// Test-only: an mDNS answer in wire format (no name compression), as a device sends one for a lockdown-over-Wi-Fi
// query, so the codec and the search can be tested without a network.
import {
  CLASS_IN,
  RecordType,
  WIFI_LOCKDOWN_SERVICE
} from '@device/infrastructure/mdns/constants.ts'
import { ByteWriter, utf8Encode } from '@ipaforge/kernel'

type RecordSpec = {
  readonly name: string
  readonly type: number
  readonly ttl?: number
  readonly data: Uint8Array
}

const nameBytes = (name: string): Uint8Array => {
  const writer = new ByteWriter()
  for (const label of name.split('.').filter(Boolean)) {
    const bytes = utf8Encode(label)
    writer.u8(bytes.length).bytes(bytes)
  }
  return writer.u8(0).toBytes()
}

export const mdnsMessage = (
  records: readonly RecordSpec[],
  id = 0
): Uint8Array => {
  const writer = new ByteWriter()
  writer
    .u16be(id)
    .u16be(0x84_00)
    .u16be(0)
    .u16be(records.length)
    .u16be(0)
    .u16be(0)
  for (const record of records)
    writer
      .bytes(nameBytes(record.name))
      .u16be(record.type)
      .u16be(CLASS_IN | 0x80_00)
      .u32be(record.ttl ?? 120)
      .u16be(record.data.length)
      .bytes(record.data)
  return writer.toBytes()
}

export const ptrData = (target: string) => nameBytes(target)

export const srvData = (port: number, target: string) =>
  new ByteWriter()
    .u16be(0)
    .u16be(0)
    .u16be(port)
    .bytes(nameBytes(target))
    .toBytes()

export const txtData = (entries: readonly string[]) => {
  const writer = new ByteWriter()
  for (const entry of entries) {
    const bytes = utf8Encode(entry)
    writer.u8(bytes.length).bytes(bytes)
  }
  return writer.toBytes()
}

export const aData = (address: string) =>
  new Uint8Array(address.split('.').map(Number))

export type FakeAdvert = {
  /** The service advertised: lockdown over Wi-Fi unless said otherwise. */
  readonly service?: string
  readonly mac: string
  readonly host: string
  readonly address: string
  readonly txt?: readonly string[]
  readonly ttl?: number
}

/** A device's whole advert in one answer, as iOS sends it: PTR, SRV, TXT and A. */
export const lockdownAdvert = (
  {
    service = WIFI_LOCKDOWN_SERVICE,
    mac,
    host,
    address,
    txt = [],
    ttl
  }: FakeAdvert,
  id = 0
) => {
  const instance = `${mac}@fe80::1-supportsRP-24.${service}`
  const at = (record: Omit<RecordSpec, 'ttl'>) => ({
    ...record,
    ...(ttl === undefined ? {} : { ttl })
  })

  return mdnsMessage(
    [
      at({
        name: service,
        type: RecordType.PTR,
        data: ptrData(instance)
      }),
      at({ name: instance, type: RecordType.SRV, data: srvData(32498, host) }),
      at({ name: instance, type: RecordType.TXT, data: txtData(txt) }),
      at({ name: host, type: RecordType.A, data: aData(address) })
    ],
    id
  )
}
