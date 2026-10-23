// Test-only: the device's end of the tunnel's TCP, written apart from the client so the two can't share a mistake.
// Server side only, over a reliable link: it never retransmits, takes data only in order (anything else gets a
// duplicate ACK), and can drop, duplicate or hold back what the client sends, close its window or stop ACKing.
import { createPipe } from '@device/__tests__/fake-device/pipe.ts'
import type { Connection } from '@device/domain/ports/types.ts'
import { createLink, type Link } from '@device/infrastructure/framing/link.ts'
import { TcpFlag } from '@device/infrastructure/tunnel/constants.ts'
import { readIpv6Packet } from '@device/infrastructure/tunnel/ipv6.ts'
import {
  decodeTcpSegment,
  encodeTcpPacket
} from '@device/infrastructure/tunnel/tcp-segment.ts'
import type {
  TcpSegment,
  TunnelAddresses
} from '@device/infrastructure/tunnel/types.ts'

export type ServiceHandler = (link: Link) => Promise<void>

export type FakeTcpPeerOptions = {
  /** The window shift offered in the SYN-ACK; `undefined` = no window scaling. */
  readonly windowShift?: number
  readonly mss?: number
  /** The receive window advertised, in bytes. */
  readonly window?: number
}

/** What the fake does with each data segment from the client, by its index (0 = the first data segment). */
export type SegmentFate = 'deliver' | 'drop' | 'duplicate' | 'hold'

export type FakeTcpPeer = {
  /** Every segment the client sent, in arrival order. */
  readonly segments: TcpSegment[]
  /** Payload bytes accepted in order, per local (device) port. */
  readonly accepted: Map<number, number>
  fate: (segment: TcpSegment, index: number) => SegmentFate
  /** The receive window advertised from now on (in bytes); an ACK with it goes out at once. */
  setWindow(bytes: number): void
  /** While true, the fake takes data but sends no ACKs. */
  holdAcks: boolean
  /** Resolves when the link ends (the client closed the tunnel). */
  readonly ended: Promise<void>
}

type PeerConnection = {
  readonly clientPort: number
  readonly devicePort: number
  rcvNxt: number
  sndNxt: number
  clientShift: number
  clientMss: number
  service?: Connection
  established: boolean
}

const DEVICE_ISS = 0x10_00_00_00

export const serveFakeTcpPeer = (
  link: Link,
  /** From the device's side: `local` is the device, `remote` the client. */
  addresses: TunnelAddresses,
  listeners: ReadonlyMap<number, ServiceHandler>,
  options: FakeTcpPeerOptions = {}
): FakeTcpPeer => {
  const connections = new Map<number, PeerConnection>()
  const shift = options.windowShift
  let window = options.window ?? 1024 * 1024
  let dataIndex = 0
  let held: TcpSegment | undefined

  const send = (
    connection: Pick<PeerConnection, 'clientPort' | 'devicePort'>,
    fields: {
      seq: number
      ack: number
      flags: number
      payload?: Uint8Array
      options?: { maxSegmentSize?: number; windowShift?: number }
    }
  ) => {
    const scaled = fields.flags & TcpFlag.Syn ? window : window >>> (shift ?? 0)
    void link.write(
      encodeTcpPacket(addresses, {
        sourcePort: connection.devicePort,
        destinationPort: connection.clientPort,
        window: Math.min(0xff_ff, scaled),
        ...fields
      })
    )
  }

  const ack = (connection: PeerConnection) => {
    if (peer.holdAcks) return
    send(connection, {
      seq: connection.sndNxt,
      ack: connection.rcvNxt,
      flags: TcpFlag.Ack
    })
  }

  /** Sends what the service writes, in segments the client's MSS takes, then FIN when it ends. */
  const pumpService = async (
    connection: PeerConnection,
    service: Connection
  ) => {
    for (let chunk = await service.read(); chunk; chunk = await service.read())
      for (let at = 0; at < chunk.length; at += connection.clientMss) {
        const payload = chunk.subarray(at, at + connection.clientMss)
        send(connection, {
          seq: connection.sndNxt,
          ack: connection.rcvNxt,
          flags: TcpFlag.Ack | TcpFlag.Psh,
          payload
        })
        connection.sndNxt = (connection.sndNxt + payload.length) >>> 0
      }
    send(connection, {
      seq: connection.sndNxt,
      ack: connection.rcvNxt,
      flags: TcpFlag.Fin | TcpFlag.Ack
    })
    connection.sndNxt = (connection.sndNxt + 1) >>> 0
  }

  const open = (segment: TcpSegment) => {
    const handler = listeners.get(segment.destinationPort)
    const ports = {
      clientPort: segment.sourcePort,
      devicePort: segment.destinationPort
    }
    if (!handler) {
      send(ports, {
        seq: 0,
        ack: (segment.seq + 1) >>> 0,
        flags: TcpFlag.Rst | TcpFlag.Ack
      })
      return
    }
    const scaling =
      shift !== undefined && segment.options.windowShift !== undefined
    const connection: PeerConnection = {
      ...ports,
      rcvNxt: (segment.seq + 1) >>> 0,
      sndNxt: DEVICE_ISS,
      clientShift: scaling ? (segment.options.windowShift ?? 0) : 0,
      clientMss: Math.min(
        segment.options.maxSegmentSize ?? 1220,
        options.mss ?? 16_000
      ),
      established: false
    }
    connections.set(segment.sourcePort, connection)
    send(connection, {
      seq: connection.sndNxt,
      ack: connection.rcvNxt,
      flags: TcpFlag.Syn | TcpFlag.Ack,
      options: {
        maxSegmentSize: options.mss ?? 16_000 - 60,
        ...(shift === undefined ? {} : { windowShift: shift })
      }
    })
    connection.sndNxt = (connection.sndNxt + 1) >>> 0
  }

  const establish = (connection: PeerConnection) => {
    connection.established = true
    const pipe = createPipe()
    connection.service = pipe.client
    void listeners.get(connection.devicePort)?.(createLink(pipe.server))
    void pumpService(connection, pipe.client)
  }

  const take = (connection: PeerConnection, segment: TcpSegment) => {
    const hasFin = (segment.flags & TcpFlag.Fin) !== 0
    if (segment.payload.length === 0 && !hasFin) return
    // Out of order, or no room: dropped, with a duplicate ACK.
    if (
      segment.seq !== connection.rcvNxt ||
      (window === 0 && segment.payload.length > 0)
    ) {
      ack(connection)
      return
    }
    if (segment.payload.length > 0) {
      void connection.service?.write(segment.payload)
      connection.rcvNxt = (connection.rcvNxt + segment.payload.length) >>> 0
      peer.accepted.set(
        connection.devicePort,
        (peer.accepted.get(connection.devicePort) ?? 0) + segment.payload.length
      )
    }
    if (hasFin) {
      connection.rcvNxt = (connection.rcvNxt + 1) >>> 0
      void connection.service?.close()
    }
    ack(connection)
  }

  const handle = (segment: TcpSegment) => {
    const connection = connections.get(segment.sourcePort)
    if (segment.flags & TcpFlag.Syn) {
      open(segment)
      return
    }
    if (!connection) return
    if (segment.flags & TcpFlag.Rst) {
      connections.delete(segment.sourcePort)
      void connection.service?.close()
      return
    }
    if (!connection.established) establish(connection)
    take(connection, segment)
  }

  /** Applies the scripted fate of a data segment; others pass. */
  const arrive = (segment: TcpSegment) => {
    if (segment.payload.length === 0) {
      handle(segment)
      return
    }
    const fate = peer.fate(segment, dataIndex++)
    if (fate === 'drop') return
    if (fate === 'hold') {
      held = segment
      return
    }
    handle(segment)
    if (fate === 'duplicate') handle(segment)
    if (held && held !== segment) {
      const late = held
      held = undefined
      handle(late)
    }
  }

  const pump = async () => {
    for (;;) {
      const packet = await readIpv6Packet(link.reader)
      const segment = decodeTcpSegment(addresses, packet.payload)
      if (!segment) continue
      peer.segments.push(segment)
      arrive(segment)
    }
  }

  const peer: FakeTcpPeer = {
    ended: Promise.resolve().then(() => pump().catch(() => undefined)),
    segments: [],
    accepted: new Map(),
    fate: () => 'deliver',
    holdAcks: false,
    setWindow: (bytes) => {
      window = bytes
      for (const connection of connections.values())
        if (connection.established) ack(connection)
    }
  }

  return peer
}
