import { describe, expect, it } from 'vitest'

import { createPipe } from '@device/__tests__/fake-device/pipe.ts'
import {
  ackedFrames,
  type FakeRsdOptions,
  type FakeRsdRecord,
  serveFakeRsd
} from '@device/__tests__/fake-tunnel/fake-rsd.ts'
import { DEFAULT_DEVICE_CONFIG } from '@device/domain/config.ts'
import { createLink } from '@device/infrastructure/framing/link.ts'
import {
  receivePlist,
  sendPlist
} from '@device/infrastructure/framing/plist-frames.ts'
import { rsdCheckin } from '@device/infrastructure/rsd/checkin.ts'
import {
  HTTP2_PREFACE,
  Http2Flag,
  Http2FrameType,
  XpcFlag,
  XpcStream
} from '@device/infrastructure/rsd/constants.ts'
import {
  encodeHttp2Frame,
  readHttp2Frame
} from '@device/infrastructure/rsd/http2.ts'
import { rsdHandshake } from '@device/infrastructure/rsd/rsd.ts'
import type { XpcValue } from '@device/infrastructure/rsd/types.ts'
import {
  createXpcMessageReader,
  decodeXpcBody,
  encodeXpcBody,
  encodeXpcMessage
} from '@device/infrastructure/rsd/xpc.ts'
import { XpcUuid } from '@device/infrastructure/rsd/xpc-uuid.ts'
import {
  createDict,
  ErrorCode,
  fromHex,
  IPAForgeError,
  toHex
} from '@ipaforge/kernel'

const LIMITS = {
  maxMessageBytes: DEFAULT_DEVICE_CONFIG.maxMessageBytes,
  plist: DEFAULT_DEVICE_CONFIG.plist
}

const protocolError = (pattern: RegExp) =>
  expect.objectContaining({
    code: ErrorCode.DeviceProtocolError,
    message: expect.stringMatching(pattern)
  })

describe('XPC objects', () => {
  it('lays out a dictionary as the device expects (little-endian, 4-byte aligned)', () => {
    expect(toHex(encodeXpcBody({ a: 'b' }))).toBe(
      [
        '42371342', // object magic
        '05000000', // version
        '00f00000', // dictionary
        '14000000', // 20 bytes follow: the count and the entries
        '01000000', // one entry
        '61000000', // "a\0", padded
        '00900000', // string
        '02000000', // two bytes with the terminator
        '62000000' // "b\0", padded
      ].join('')
    )
  })

  it('round-trips every type', () => {
    const value: XpcValue = {
      null: null,
      yes: true,
      no: false,
      int: -42,
      uint: 0x01_00_00_00_00_00_00_06n,
      double: 1.5,
      text: 'héllo',
      empty: '',
      data: new Uint8Array([1, 2, 3, 4, 5]),
      when: new Date('2026-10-22T10:00:00.123Z'),
      uuid: new XpcUuid(fromHex('00112233445566778899aabbccddeeff')),
      list: [1, 'two', [3n]],
      nested: { deeper: { deepest: {} } }
    }
    expect(decodeXpcBody(encodeXpcBody(value))).toEqual(value)
  })

  it('prints UUIDs the usual way', () => {
    expect(
      String(new XpcUuid(fromHex('00112233445566778899aabbccddeeff')))
    ).toBe('00112233-4455-6677-8899-AABBCCDDEEFF')
  })

  it('keeps a `__proto__` key as data', () => {
    const decoded = decodeXpcBody(
      encodeXpcBody(JSON.parse('{"__proto__": {"polluted": true}}'))
    ) as Record<string, unknown>
    expect(Object.hasOwn(decoded, '__proto__')).toBe(true)
    expect(({} as Record<string, unknown>).polluted).toBeUndefined()
  })

  it('refuses unknown types, truncated objects and runaway nesting', () => {
    const body = encodeXpcBody({ a: 'b' })
    const unknown = body.slice()
    unknown.set([0x00, 0x0b, 0x00, 0x00], 8)
    expect(() => decodeXpcBody(unknown)).toThrow(protocolError(/unknown type/))
    expect(() => decodeXpcBody(body.subarray(0, body.length - 4))).toThrow(
      protocolError(/runs past/)
    )
    let deep: XpcValue = []
    for (let level = 0; level < 70; level++) deep = [deep]
    expect(() => decodeXpcBody(encodeXpcBody(deep))).toThrow(
      protocolError(/nested deeper/)
    )
  })

  it('splits a stream into messages, keeping a partial one for later', () => {
    const first = encodeXpcMessage({
      flags: XpcFlag.AlwaysSet | XpcFlag.DataPresent,
      id: 1n,
      body: { MessageType: 'Handshake' }
    })
    const second = encodeXpcMessage({ flags: XpcFlag.AlwaysSet, id: 2n })
    const read = createXpcMessageReader(1024)
    const joined = new Uint8Array([...first, ...second])
    expect(read(joined.subarray(0, 30))).toEqual([])
    expect(read(joined.subarray(30))).toEqual([
      {
        flags: XpcFlag.AlwaysSet | XpcFlag.DataPresent,
        id: 1n,
        body: { MessageType: 'Handshake' }
      },
      { flags: XpcFlag.AlwaysSet, id: 2n }
    ])
    expect(() => createXpcMessageReader(8)(first)).toThrow(
      protocolError(/exceeds the limit/)
    )
  })
})

describe('HTTP/2 frames', () => {
  it('writes the 9-byte header and reads it back', async () => {
    const frame = {
      type: Http2FrameType.Headers,
      flags: Http2Flag.EndHeaders,
      streamId: XpcStream.Reply,
      payload: new Uint8Array([7, 8])
    }
    const bytes = encodeHttp2Frame(frame)
    expect(toHex(bytes)).toBe('000002010400000003' + '0708')
    const pipe = createPipe()
    await pipe.server.write(bytes)
    expect(await readHttp2Frame(createLink(pipe.client), 16)).toEqual(frame)
  })

  it('refuses a frame over the limit', async () => {
    const pipe = createPipe()
    await pipe.server.write(
      encodeHttp2Frame({
        type: Http2FrameType.Data,
        flags: 0,
        streamId: 1,
        payload: new Uint8Array(32)
      })
    )
    await expect(readHttp2Frame(createLink(pipe.client), 16)).rejects.toEqual(
      protocolError(/32-byte frame/)
    )
  })
})

const SERVICES = {
  'com.apple.afc.shim.remote': {
    Port: '50001',
    Properties: { UsesRemoteXPC: false }
  },
  'com.apple.coredevice.appservice': {
    Port: 50_002n,
    Entitlement: 'com.apple.private.example',
    Properties: { UsesRemoteXPC: true }
  }
}

const handshakeWith = async (options: Partial<FakeRsdOptions> = {}) => {
  const pipe = createPipe()
  const record: FakeRsdRecord = {
    preface: '',
    frames: [],
    messages: new Map()
  }
  void serveFakeRsd(
    createLink(pipe.server),
    { services: SERVICES, ...options },
    record
  )
  const result = rsdHandshake(createLink(pipe.client), {
    maxMessageBytes: 1024 * 1024,
    timeoutMs: 200
  })

  return { result, record }
}

describe('the RSD handshake', () => {
  it("returns the device's services and properties", async () => {
    const { result } = await handshakeWith({
      properties: { ProductVersion: '26.6.1', UniqueDeviceID: 'UDID' }
    })
    const handshake = await result
    expect([...handshake.services.values()]).toEqual([
      {
        name: 'com.apple.afc.shim.remote',
        port: 50_001,
        usesRemoteXpc: false
      },
      {
        name: 'com.apple.coredevice.appservice',
        port: 50_002,
        usesRemoteXpc: true,
        entitlement: 'com.apple.private.example'
      }
    ])
    expect(handshake.properties).toEqual({
      ProductVersion: '26.6.1',
      UniqueDeviceID: 'UDID'
    })
    expect(handshake.protocolVersion).toBe(7)
  })

  it('opens both streams, then sends its own Handshake first', async () => {
    const { result, record } = await handshakeWith()
    await result
    expect(record.preface).toBe(HTTP2_PREFACE)
    expect(
      record.frames.slice(0, 8).map((frame) => [frame.type, frame.streamId])
    ).toEqual([
      [Http2FrameType.Settings, 0],
      [Http2FrameType.WindowUpdate, 0],
      [Http2FrameType.Headers, XpcStream.Root],
      [Http2FrameType.Data, XpcStream.Root],
      [Http2FrameType.Data, XpcStream.Root],
      [Http2FrameType.Headers, XpcStream.Reply],
      [Http2FrameType.Data, XpcStream.Reply],
      [Http2FrameType.Data, XpcStream.Root]
    ])
    const root = record.messages.get(XpcStream.Root) ?? []
    // Exactly AlwaysSet on the first one: with DataPresent the device goes silent.
    expect(root.map((message) => message.flags)).toEqual([
      XpcFlag.AlwaysSet,
      XpcFlag.AlwaysSet | XpcFlag.ChannelOpen,
      XpcFlag.AlwaysSet | XpcFlag.DataPresent
    ])
    expect(root[0]?.body).toEqual({})
    expect(root[2]?.body).toMatchObject({
      MessageType: 'Handshake',
      MessagingProtocolVersion: 7n,
      Properties: { RemoteXPCVersionFlags: 0x01_00_00_00_00_00_00_06n },
      Services: {}
    })
    expect(record.messages.get(XpcStream.Reply)?.[0]?.flags).toBe(
      XpcFlag.AlwaysSet | XpcFlag.InitHandshake
    )
  })

  it("acknowledges the device's SETTINGS and PING", async () => {
    const { result, record } = await handshakeWith()
    await result
    // The fake reads on after answering: give it a turn to see the ACKs.
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(ackedFrames(record, Http2FrameType.Settings)).toHaveLength(1)
    expect(ackedFrames(record, Http2FrameType.Ping)).toHaveLength(1)
  })

  it('times out when the device stays silent', async () => {
    const { result } = await handshakeWith({ silent: true })
    await expect(result).rejects.toMatchObject({
      code: ErrorCode.DeviceTimeout
    })
  })

  it('fails on GOAWAY', async () => {
    const { result } = await handshakeWith({ goAway: true })
    await expect(result).rejects.toMatchObject({
      code: ErrorCode.DeviceProtocolError,
      data: { lastStreamId: 1, errorCode: 2 }
    })
  })

  it('refuses a service map it cannot read', async () => {
    const { result } = await handshakeWith({
      services: { 'com.apple.afc.shim.remote': { Port: 'none' } }
    })
    await expect(result).rejects.toEqual(protocolError(/cannot read/))
  })
})

describe('RSDCheckin', () => {
  const checkIn = async (replies: [string, string][][]) => {
    const pipe = createPipe()
    const device = createLink(pipe.server)
    const checkedIn = rsdCheckin(createLink(pipe.client), {
      label: 'ipaforge',
      limits: LIMITS,
      service: 'com.apple.afc.shim.remote'
    })
    const request = await receivePlist(device, LIMITS)
    for (const reply of replies) await sendPlist(device, createDict(reply))

    return { request, checkedIn }
  }

  it('sends the check-in and waits for StartService', async () => {
    const { request, checkedIn } = await checkIn([
      [['Request', 'RSDCheckin']],
      [['Request', 'StartService']]
    ])
    await checkedIn
    expect(request).toEqual(
      createDict([
        ['Label', 'ipaforge'],
        ['ProtocolVersion', '2'],
        ['Request', 'RSDCheckin']
      ])
    )
  })

  it('turns a refusal into device.service_unavailable', async () => {
    const { checkedIn } = await checkIn([[['Error', 'ServiceProhibited']]])
    const error = await checkedIn.catch((caught: unknown) => caught)
    expect(error).toBeInstanceOf(IPAForgeError)
    expect(error).toMatchObject({
      code: ErrorCode.ServiceUnavailable,
      data: { error: 'ServiceProhibited' }
    })
  })

  it('refuses an answer out of order', async () => {
    const { checkedIn } = await checkIn([[['Request', 'StartService']]])
    await expect(checkedIn).rejects.toEqual(
      protocolError(/expected RSDCheckin/)
    )
  })
})
