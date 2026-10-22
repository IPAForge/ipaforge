import { describe, expect, it } from 'vitest'

import { createPipe } from '@device/__tests__/fake-device/pipe.ts'
import {
  type FakeTcpPeerOptions,
  type ServiceHandler,
  serveFakeTcpPeer
} from '@device/__tests__/fake-tunnel/fake-tcp-peer.ts'
import type { Connection } from '@device/domain/ports/types.ts'
import { createLink, type Link } from '@device/infrastructure/framing/link.ts'
import {
  cdTunnelHandshake,
  encodeCdTunnelMessage,
  readCdTunnelMessage
} from '@device/infrastructure/tunnel/cdtunnel.ts'
import {
  IPV6_HEADER_BYTES,
  TcpFlag
} from '@device/infrastructure/tunnel/constants.ts'
import {
  parseIpv6Address,
  readIpv6Packet,
  writeIpv6Header
} from '@device/infrastructure/tunnel/ipv6.ts'
import {
  decodeOptions,
  decodeTcpSegment,
  encodeTcpPacket
} from '@device/infrastructure/tunnel/tcp-segment.ts'
import {
  createTcpStack,
  windowShiftFor
} from '@device/infrastructure/tunnel/tcp-stack.ts'
import type {
  TcpConfig,
  TunnelAddresses
} from '@device/infrastructure/tunnel/types.ts'
import {
  ErrorCode,
  silentLogger,
  toHex,
  utf8Decode,
  utf8Encode
} from '@ipaforge/kernel'

const CLIENT = parseIpv6Address('2001:db8:8961::2')
const DEVICE = parseIpv6Address('2001:db8:8961::1')
const CLIENT_VIEW: TunnelAddresses = { local: CLIENT, remote: DEVICE }
const DEVICE_VIEW: TunnelAddresses = { local: DEVICE, remote: CLIENT }
const ECHO_PORT = 49_200

/** Short timeouts so loss is repaired fast, and room for many in a row: a loaded test run can stall for a while. */
const CONFIG: TcpConfig = {
  mtu: 1500,
  initialRtoMs: 5,
  maxRtoMs: 40,
  maxRetransmits: 30,
  sendBufferBytes: 64 * 1024,
  receiveBufferBytes: 256 * 1024
}

const GIVE_UP_FAST: TcpConfig = {
  ...CONFIG,
  initialRtoMs: 1,
  maxRtoMs: 2,
  maxRetransmits: 4
}

/** A timeout long enough that a slow, loaded test run never retransmits. */
const NO_TIMEOUTS: TcpConfig = {
  ...CONFIG,
  initialRtoMs: 5000,
  maxRtoMs: 5000
}

const randomBytes = (length: number): Uint8Array => {
  const bytes = new Uint8Array(length)
  for (let at = 0; at < length; at += 65_536)
    globalThis.crypto.getRandomValues(bytes.subarray(at, at + 65_536))
  return bytes
}

/** Reads `length` bytes and sends them back. */
const echo =
  (length: number): ServiceHandler =>
  async (link) => {
    await link.write(await link.reader.readExact(length))
    await link.close()
  }

type Writes = {
  readonly sizes: number[]
  /** Each data packet's sequence number, in write order. */
  readonly dataSeqs: number[]
  maxConcurrent: number
}

/** The client's link, watched: every write and how many ran at once (each is slowed by a macrotask). */
const watchedLink = (connection: Connection, writes: Writes): Link => {
  let running = 0

  return createLink({
    ...connection,
    write: async (bytes) => {
      running++
      writes.maxConcurrent = Math.max(writes.maxConcurrent, running)
      writes.sizes.push(bytes.length)
      const isSyn = ((bytes[IPV6_HEADER_BYTES + 13] ?? 0) & TcpFlag.Syn) !== 0
      if (!isSyn && bytes.length > IPV6_HEADER_BYTES + 20)
        writes.dataSeqs.push(
          new DataView(bytes.buffer, bytes.byteOffset).getUint32(
            IPV6_HEADER_BYTES + 4
          )
        )
      await new Promise((resolve) => setTimeout(resolve, 0))
      await connection.write(bytes)
      running--
    }
  })
}

const rig = (
  listeners: ReadonlyMap<number, ServiceHandler>,
  peerOptions: FakeTcpPeerOptions = { windowShift: 6 },
  config: TcpConfig = CONFIG
) => {
  const pipe = createPipe()
  const writes: Writes = { sizes: [], dataSeqs: [], maxConcurrent: 0 }
  const stack = createTcpStack(
    watchedLink(pipe.client, writes),
    CLIENT_VIEW,
    config,
    silentLogger
  )
  const peer = serveFakeTcpPeer(
    createLink(pipe.server),
    DEVICE_VIEW,
    listeners,
    peerOptions
  )

  return { stack, peer, writes, pipe }
}

/** Sends `data` to the echo service and reads it back. */
const roundTrip = async (
  stack: ReturnType<typeof rig>['stack'],
  data: Uint8Array
): Promise<Uint8Array> => {
  const link = createLink(await stack.connect(ECHO_PORT))
  await link.write(data)
  const back = await link.reader.readExact(data.length)
  await link.close()
  return back
}

describe('IPv6 addresses', () => {
  it('reads the forms the tunnel uses', () => {
    expect(toHex(parseIpv6Address('2001:db8:8961::2'))).toBe(
      '20010db8896100000000000000000002'
    )
    expect(toHex(parseIpv6Address('::1'))).toBe(
      '00000000000000000000000000000001'
    )
    expect(toHex(parseIpv6Address('2001:db8::'))).toBe(
      '20010db8000000000000000000000000'
    )
    expect(toHex(parseIpv6Address('2001:db8:1:2:3:4:5:6'))).toBe(
      '20010db8000100020003000400050006'
    )
  })

  it.each([
    '1::2::3',
    '1:2:3:4:5:6:7',
    '1:2:3:4:5:6:7:8:9',
    '1:2:3:4::5:6:7:8',
    'g::1',
    '12345::1',
    ':1'
  ])('refuses %s', (text) => {
    expect(() => parseIpv6Address(text)).toThrow(/bad IPv6 address/)
  })
})

describe('TCP segments', () => {
  it('builds a SYN with MSS and window scale, and the right checksum', () => {
    const packet = encodeTcpPacket(CLIENT_VIEW, {
      sourcePort: 50_000,
      destinationPort: 58_783,
      seq: 0x01_02_03_04,
      ack: 0,
      flags: TcpFlag.Syn,
      window: 0xff_ff,
      options: { maxSegmentSize: 7940, windowShift: 7 }
    })
    expect(packet).toHaveLength(IPV6_HEADER_BYTES + 28)
    const tcp = packet.subarray(IPV6_HEADER_BYTES)
    // Header length 7 words; options MSS 7940, NOP, window scale 7.
    expect(tcp[12]).toBe(0x70)
    expect(toHex(tcp.subarray(20))).toBe('02041f0401030307')
    // Computed independently of this code.
    expect(toHex(tcp.subarray(16, 18))).toBe('4f9a')
    expect(toHex(packet.subarray(0, 8))).toBe('60000000001c0640')
  })

  it('matches an independently computed checksum on a data segment', () => {
    const packet = encodeTcpPacket(CLIENT_VIEW, {
      sourcePort: 50_000,
      destinationPort: 58_783,
      seq: 0x01_02_03_05,
      ack: 0x10_00_00_01,
      flags: TcpFlag.Psh | TcpFlag.Ack,
      window: 0x02_00,
      payload: utf8Encode('hello')
    })
    expect(
      toHex(packet.subarray(IPV6_HEADER_BYTES + 16, IPV6_HEADER_BYTES + 18))
    ).toBe('3ec5')
  })

  it('reads back what it builds, and drops a segment that fails its checksum', () => {
    const packet = encodeTcpPacket(DEVICE_VIEW, {
      sourcePort: 58_783,
      destinationPort: 50_000,
      seq: 9,
      ack: 0x01_02_03_05,
      flags: TcpFlag.Syn | TcpFlag.Ack,
      window: 1234,
      options: { maxSegmentSize: 15_940, windowShift: 6 },
      payload: utf8Encode('x')
    })
    const segment = decodeTcpSegment(
      CLIENT_VIEW,
      packet.subarray(IPV6_HEADER_BYTES)
    )
    expect(segment).toMatchObject({
      sourcePort: 58_783,
      destinationPort: 50_000,
      seq: 9,
      ack: 0x01_02_03_05,
      flags: TcpFlag.Syn | TcpFlag.Ack,
      window: 1234,
      options: { maxSegmentSize: 15_940, windowShift: 6 }
    })
    expect(utf8Decode(segment?.payload ?? new Uint8Array())).toBe('x')
    const corrupt = packet.slice(IPV6_HEADER_BYTES)
    corrupt[corrupt.length - 1] = (corrupt.at(-1) ?? 0) ^ 0xff
    expect(decodeTcpSegment(CLIENT_VIEW, corrupt)).toBeUndefined()
    // Checked against the tunnel's addresses: the same bytes from another address fail.
    expect(
      decodeTcpSegment(
        { local: CLIENT, remote: parseIpv6Address('2001:db8::9') },
        packet.subarray(IPV6_HEADER_BYTES)
      )
    ).toBeUndefined()
  })

  it('skips options it does not use and stops at a malformed one', () => {
    // Timestamps (8, length 10), then MSS, then window scale.
    expect(
      decodeOptions(
        new Uint8Array([
          8, 10, 0, 0, 0, 1, 0, 0, 0, 0, 2, 4, 0x05, 0xb4, 1, 3, 3, 2
        ])
      )
    ).toEqual({ maxSegmentSize: 1460, windowShift: 2 })
    expect(
      decodeOptions(new Uint8Array([2, 4, 0x05, 0xb4, 0, 3, 3, 2]))
    ).toEqual({ maxSegmentSize: 1460 })
    expect(decodeOptions(new Uint8Array([3, 0, 3, 3, 2]))).toEqual({})
    expect(decodeOptions(new Uint8Array([2, 40, 1]))).toEqual({})
  })

  it('picks the smallest window shift that covers the buffer', () => {
    expect(windowShiftFor(65_535)).toBe(0)
    expect(windowShiftFor(65_536)).toBe(1)
    expect(windowShiftFor(4 * 1024 * 1024)).toBe(7)
    expect(windowShiftFor(2 ** 31)).toBe(14)
  })
})

describe('the CDTunnel handshake', () => {
  it('asks for an MTU and reads what the device agreed', async () => {
    const pipe = createPipe()
    const device = createLink(pipe.server)
    const handshake = cdTunnelHandshake(createLink(pipe.client), 8000)
    const request = await readCdTunnelMessage(device)
    expect(request).toEqual({ type: 'clientHandshakeRequest', mtu: 8000 })
    await device.write(
      encodeCdTunnelMessage({
        clientParameters: {
          address: '2001:db8:8961::2',
          mtu: 8000,
          // eslint-disable-next-line sonarjs/no-hardcoded-ip -- a netmask, as the device's real answer carries it
          netmask: 'ffff:ffff:ffff:ffff::'
        },
        serverAddress: '2001:db8:8961::1',
        serverRSDPort: 58_783,
        type: 'serverHandshakeResponse'
      })
    )
    expect(await handshake).toEqual({
      clientAddress: '2001:db8:8961::2',
      serverAddress: '2001:db8:8961::1',
      rsdPort: 58_783,
      mtu: 8000
    })
  })

  it('frames each message as the magic, a big-endian length and JSON', () => {
    const bytes = encodeCdTunnelMessage({ a: 1 })
    expect(utf8Decode(bytes.subarray(0, 8))).toBe('CDTunnel')
    expect(toHex(bytes.subarray(8, 10))).toBe('0007')
    expect(utf8Decode(bytes.subarray(10))).toBe('{"a":1}')
  })

  it('refuses a wrong magic or an answer it cannot read', async () => {
    const wrongMagic = createPipe()
    void wrongMagic.server.write(utf8Encode('NotATunnel'))
    await expect(
      cdTunnelHandshake(createLink(wrongMagic.client), 8000)
    ).rejects.toMatchObject({ code: ErrorCode.DeviceProtocolError })

    const wrongAnswer = createPipe()
    void wrongAnswer.server.write(
      encodeCdTunnelMessage({ type: 'serverHandshakeResponse' })
    )
    await expect(
      cdTunnelHandshake(createLink(wrongAnswer.client), 8000)
    ).rejects.toMatchObject({
      code: ErrorCode.DeviceProtocolError,
      message: expect.stringMatching(/unexpected handshake response/)
    })
  })
})

describe('the TCP client', () => {
  it('carries data both ways and closes', async () => {
    const data = randomBytes(200_000)
    const { stack, peer } = rig(
      new Map([[ECHO_PORT, echo(data.length)]]),
      { windowShift: 6 },
      NO_TIMEOUTS
    )
    expect(await roundTrip(stack, data)).toEqual(data)
    expect(peer.accepted.get(ECHO_PORT)).toBe(data.length)
    await expect
      .poll(() => peer.segments.some((s) => s.flags & TcpFlag.Fin))
      .toBe(true)
    expect(stack.stats.retransmits).toBe(0)
    await stack.close()
  })

  it('writes one packet per write, one write at a time, none over the MTU', async () => {
    const data = randomBytes(50_000)
    const { stack, writes } = rig(
      new Map([[ECHO_PORT, echo(data.length)]]),
      { windowShift: 6 },
      NO_TIMEOUTS
    )
    expect(await roundTrip(stack, data)).toEqual(data)
    expect(writes.maxConcurrent).toBe(1)
    expect(Math.max(...writes.sizes)).toBe(CONFIG.mtu)
    // 50,000 bytes in 1,440-byte segments: 35 data packets, plus the handshake, ACKs and FIN.
    expect(writes.sizes.filter((size) => size === CONFIG.mtu)).toHaveLength(34)
    await stack.close()
  })

  it('offers window scaling and keeps within the peer window', async () => {
    const data = randomBytes(64 * 1024)
    // Timeouts while the ACKs are held back must not give the connection up.
    const { stack, peer } = rig(
      new Map([[ECHO_PORT, echo(data.length)]]),
      { windowShift: 2, window: 8 * 1024 },
      { ...CONFIG, maxRetransmits: 100 }
    )
    const link = createLink(await stack.connect(ECHO_PORT))
    const syn = peer.segments[0]
    expect(syn?.options).toEqual({
      maxSegmentSize: CONFIG.mtu - 60,
      windowShift: windowShiftFor(CONFIG.receiveBufferBytes)
    })
    peer.holdAcks = true
    const written = link.write(data)
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(peer.accepted.get(ECHO_PORT)).toBeLessThanOrEqual(8 * 1024)
    peer.holdAcks = false
    peer.setWindow(1024 * 1024)
    await written
    expect(await link.reader.readExact(data.length)).toEqual(data)
    // Our window field is scaled once both sides agreed: 256 KiB >> 3.
    const ack = peer.segments.find(
      (segment) => segment.flags === TcpFlag.Ack && segment.payload.length === 0
    )
    expect(ack?.window).toBe((256 * 1024) >>> 3)
    await stack.close()
  })

  it('does without window scaling when the peer offers none', async () => {
    const data = randomBytes(30_000)
    const { stack, peer } = rig(new Map([[ECHO_PORT, echo(data.length)]]), {
      window: 60_000
    })
    expect(await roundTrip(stack, data)).toEqual(data)
    const ack = peer.segments.find(
      (segment) => segment.flags === TcpFlag.Ack && segment.payload.length === 0
    )
    expect(ack?.window).toBe(0xff_ff)
    await stack.close()
  })

  it('recovers segments the device drops', async () => {
    const data = randomBytes(100_000)
    const { stack, peer } = rig(new Map([[ECHO_PORT, echo(data.length)]]))
    const dropped = new Set([2, 5, 40])
    peer.fate = (_, index) => (dropped.delete(index) ? 'drop' : 'deliver')
    expect(await roundTrip(stack, data)).toEqual(data)
    expect(dropped.size).toBe(0)
    expect(stack.stats.retransmits).toBeGreaterThanOrEqual(3)
    await stack.close()
  })

  it('sends a retransmission ahead of the data already waiting to be written', async () => {
    const data = randomBytes(40 * (CONFIG.mtu - 60))
    const { stack, peer, writes } = rig(
      new Map([[ECHO_PORT, echo(data.length)]]),
      { windowShift: 6 },
      NO_TIMEOUTS
    )
    let dropped = false
    peer.fate = (_, index) => {
      if (index !== 1 || dropped) return 'deliver'
      dropped = true
      return 'drop'
    }
    expect(await roundTrip(stack, data)).toEqual(data)
    const lost = writes.dataSeqs[1]
    const resent = writes.dataSeqs.lastIndexOf(lost ?? -1)
    // Fast retransmit after three duplicate ACKs, written long before the 40th segment.
    expect(resent).toBeGreaterThan(1)
    expect(resent).toBeLessThan(20)
    expect(stack.stats.timeouts).toBe(0)
    await stack.close()
  })

  it('recovers a lost last segment by timeout alone', async () => {
    const data = utf8Encode('one segment, lost once')
    const { stack, peer } = rig(new Map([[ECHO_PORT, echo(data.length)]]))
    let first = true
    peer.fate = () => {
      const fate = first ? 'drop' : 'deliver'
      first = false
      return fate
    }
    expect(await roundTrip(stack, data)).toEqual(data)
    expect(stack.stats.timeouts).toBeGreaterThanOrEqual(1)
    await stack.close()
  })

  it('takes duplicated and reordered segments in its stride', async () => {
    const data = randomBytes(60_000)
    const { stack, peer } = rig(new Map([[ECHO_PORT, echo(data.length)]]))
    peer.fate = (_, index) => {
      if (index === 1 || index === 7) return 'duplicate'
      if (index === 3) return 'hold'
      return 'deliver'
    }
    expect(await roundTrip(stack, data)).toEqual(data)
    await stack.close()
  })

  it('keeps probing a closed window as long as the device answers, then sends', async () => {
    const data = randomBytes(4000)
    const config = { ...CONFIG, maxRetransmits: 4 }
    const { stack, peer } = rig(
      new Map([[ECHO_PORT, echo(data.length)]]),
      { windowShift: 6, window: 0 },
      config
    )
    const link = createLink(await stack.connect(ECHO_PORT))
    const written = link.write(data)
    await expect
      .poll(() => stack.stats.timeouts, { timeout: 5000 })
      .toBeGreaterThan(config.maxRetransmits + 1)
    peer.setWindow(64 * 1024)
    await written
    expect(await link.reader.readExact(data.length)).toEqual(data)
    await stack.close()
  })

  it('fails the connect when the device resets it', async () => {
    const { stack } = rig(new Map())
    await expect(stack.connect(1234)).rejects.toMatchObject({
      code: ErrorCode.DeviceDisconnected,
      message: expect.stringMatching(/reset the connection to port 1234/)
    })
    await stack.close()
  })

  it('gives up on a device that never answers', async () => {
    const pipe = createPipe()
    const stack = createTcpStack(
      createLink(pipe.client),
      CLIENT_VIEW,
      GIVE_UP_FAST,
      silentLogger
    )
    await expect(stack.connect(ECHO_PORT)).rejects.toMatchObject({
      code: ErrorCode.DeviceTimeout
    })
    const device = createLink(pipe.server)
    const syns: number[] = []
    for (let index = 0; index <= GIVE_UP_FAST.maxRetransmits; index++) {
      const packet = await readIpv6Packet(device.reader)
      syns.push(packet.payload[13] ?? 0)
    }
    expect(syns.every((flags) => flags === TcpFlag.Syn)).toBe(true)
    await stack.close()
  })

  it('fails reads, writes and connects once the tunnel ends', async () => {
    const data = randomBytes(10)
    const { stack, pipe } = rig(new Map([[ECHO_PORT, echo(data.length * 2)]]))
    const link = createLink(await stack.connect(ECHO_PORT))
    await link.write(data)
    const reading = link.reader.readExact(data.length)
    await pipe.server.close()
    await expect(reading).rejects.toMatchObject({
      code: ErrorCode.DeviceDisconnected
    })
    await expect(link.write(data)).rejects.toMatchObject({
      code: ErrorCode.DeviceDisconnected
    })
    await expect(stack.connect(ECHO_PORT)).rejects.toMatchObject({
      code: ErrorCode.DeviceDisconnected
    })
  })

  it('refuses TLS: the tunnel is already encrypted', async () => {
    const { stack } = rig(new Map([[ECHO_PORT, echo(1)]]))
    const connection = await stack.connect(ECHO_PORT)
    await expect(
      connection.startTls({
        certificatePem: '',
        privateKeyPem: '',
        rootCertificatePem: '',
        expectedPeerCertificate: new Uint8Array()
      })
    ).rejects.toMatchObject({ code: ErrorCode.DeviceProtocolError })
    await stack.close()
  })
})

describe('the packet pump', () => {
  const rawRig = () => {
    const pipe = createPipe()
    const stack = createTcpStack(
      createLink(pipe.client),
      CLIENT_VIEW,
      CONFIG,
      silentLogger
    )

    return { stack, device: createLink(pipe.server) }
  }

  it('answers a segment for an unknown port with RST', async () => {
    const { stack, device } = rawRig()
    await device.write(
      encodeTcpPacket(DEVICE_VIEW, {
        sourcePort: 58_783,
        destinationPort: 50_123,
        seq: 77,
        ack: 1000,
        flags: TcpFlag.Ack | TcpFlag.Psh,
        window: 100,
        payload: utf8Encode('late')
      })
    )
    const reply = await readIpv6Packet(device.reader)
    expect(decodeTcpSegment(DEVICE_VIEW, reply.payload)).toMatchObject({
      sourcePort: 50_123,
      destinationPort: 58_783,
      seq: 1000,
      flags: TcpFlag.Rst
    })
    await stack.close()
  })

  it('ignores packets that are not TCP between the two addresses, or fail their checksum', async () => {
    const { stack, device } = rawRig()
    // Next header 0 (hop-by-hop options), as the device sends now and then.
    const other = new Uint8Array(IPV6_HEADER_BYTES + 8)
    writeIpv6Header(other, 0, DEVICE, CLIENT)
    await device.write(other)
    // TCP from another address.
    await device.write(
      encodeTcpPacket(
        { local: parseIpv6Address('2001:db8::9'), remote: CLIENT },
        {
          sourcePort: 1,
          destinationPort: 2,
          seq: 0,
          ack: 0,
          flags: TcpFlag.Ack,
          window: 0
        }
      )
    )
    // A bad checksum.
    const corrupt = encodeTcpPacket(DEVICE_VIEW, {
      sourcePort: 1,
      destinationPort: 2,
      seq: 0,
      ack: 0,
      flags: TcpFlag.Ack,
      window: 0
    })
    corrupt[IPV6_HEADER_BYTES + 16] =
      (corrupt[IPV6_HEADER_BYTES + 16] ?? 0) ^ 0xff
    await device.write(corrupt)
    await expect.poll(() => stack.stats.ignoredPackets).toBe(3)
    await stack.close()
  })

  it('fails everything when the packet framing is lost', async () => {
    const { stack, device } = rawRig()
    const connecting = stack.connect(ECHO_PORT)
    await device.write(new Uint8Array(IPV6_HEADER_BYTES))
    await expect(connecting).rejects.toMatchObject({
      code: ErrorCode.DeviceProtocolError,
      message: expect.stringMatching(/lost packet framing/)
    })
  })
})
