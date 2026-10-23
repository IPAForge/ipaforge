// A userspace TCP client over the tunnel's packet stream: one peer (the device), client connections only, no OS
// network interface and no admin rights.
//
// Two rules the device imposes (measured on iOS 26 over USB):
// - one IPv6 packet per write, each started only after the previous one finished. Pending writes on a TLS socket
//   are bundled into one TLS record of up to 16 KB, and the device's tunnel loses packets from bundled records, at
//   any rate. Serialized, a 100 MiB upload ran at 34 MiB/s with no retransmission;
// - packets to the device must stay under about 8 KB, whatever MTU the tunnel agreed: larger ones stall the
//   connection. `config.mtu` caps every packet we send.
// Retransmissions jump the queue of packets waiting to be written: behind a full window of new data they would
// reach the device only after the next timeout, and every timeout would queue another copy.
import type { Connection } from '@device/domain/ports/types.ts'
import type { Link } from '@device/infrastructure/framing/link.ts'
import {
  EPHEMERAL_PORT_FIRST,
  EPHEMERAL_PORT_LAST,
  NEXT_HEADER_TCP,
  TCP_MAX_WINDOW_FIELD,
  TCP_MAX_WINDOW_SHIFT,
  TcpFlag
} from '@device/infrastructure/tunnel/constants.ts'
import { readIpv6Packet } from '@device/infrastructure/tunnel/ipv6.ts'
import { createTcpConnection } from '@device/infrastructure/tunnel/tcp-connection.ts'
import {
  decodeTcpSegment,
  encodeTcpPacket
} from '@device/infrastructure/tunnel/tcp-segment.ts'
import type {
  TcpConfig,
  TcpConnection,
  TcpSegment,
  TcpStack,
  TcpStats,
  TunnelAddresses
} from '@device/infrastructure/tunnel/types.ts'
import {
  ErrorCode,
  equalBytes,
  IPAForgeError,
  type Logger
} from '@ipaforge/kernel'

/** The smallest window shift that lets the window field cover `bytes` (RFC 7323 §2.3). */
export const windowShiftFor = (bytes: number): number => {
  let shift = 0
  while (shift < TCP_MAX_WINDOW_SHIFT && TCP_MAX_WINDOW_FIELD << shift < bytes)
    shift++
  return shift
}

const randomU32 = (): number =>
  globalThis.crypto.getRandomValues(new Uint32Array(1))[0] ?? 0

/**
 * One packet per `link.write`, each started after the previous one finished (see the header). A retransmission
 * goes first, after the write in progress; at most one waits per connection (`urgentKey`), the newest.
 */
const createPacketWriter = (link: Link, onError: (error: unknown) => void) => {
  const pending: Uint8Array[] = []
  const urgent = new Map<number, Uint8Array>()
  let draining = false

  const next = (): Uint8Array | undefined => {
    const [key, packet] = urgent.entries().next().value ?? []
    if (key === undefined) return pending.shift()
    urgent.delete(key)
    return packet
  }

  const drain = async (): Promise<void> => {
    draining = true
    try {
      for (let packet = next(); packet; packet = next())
        await link.write(packet)
    } catch (error) {
      pending.length = 0
      urgent.clear()
      onError(error)
    } finally {
      draining = false
    }
  }

  return (packet: Uint8Array, urgentKey?: number): void => {
    if (urgentKey === undefined) pending.push(packet)
    else urgent.set(urgentKey, packet)
    if (!draining) void drain()
  }
}

/**
 * Runs TCP over `link`, which carries the tunnel's IPv6 packets after the CDTunnel handshake. The stack owns the
 * link: `close()` closes it, and when it ends every connection fails with `device.disconnected`.
 */
export const createTcpStack = (
  link: Link,
  addresses: TunnelAddresses,
  config: TcpConfig,
  logger: Logger
): TcpStack => {
  const connections = new Map<number, TcpConnection>()
  const stats: TcpStats = {
    segmentsOut: 0,
    segmentsIn: 0,
    bytesOut: 0,
    bytesIn: 0,
    retransmits: 0,
    timeouts: 0,
    ignoredPackets: 0
  }
  const windowShift = windowShiftFor(config.receiveBufferBytes)
  let ended: Error | undefined

  const end = (error: Error): void => {
    if (ended) return
    ended = error
    for (const connection of [...connections.values()]) connection.fail(error)
    connections.clear()
  }

  const linkLost = (cause: unknown) =>
    new IPAForgeError(ErrorCode.DeviceDisconnected, {
      message: 'tunnel: the link to the device ended',
      cause
    })

  const write = createPacketWriter(link, (error) => {
    logger.debug('tunnel write failed', { cause: error })
    end(linkLost(error))
  })

  /** Answers a segment for a port we don't know with RST (RFC 9293 §3.10.7.1), unless it is one itself. */
  const refuse = (segment: TcpSegment): void => {
    if (segment.flags & TcpFlag.Rst) return
    const hasAck = (segment.flags & TcpFlag.Ack) !== 0
    const length =
      segment.payload.length +
      (segment.flags & TcpFlag.Syn ? 1 : 0) +
      (segment.flags & TcpFlag.Fin ? 1 : 0)
    write(
      encodeTcpPacket(addresses, {
        sourcePort: segment.destinationPort,
        destinationPort: segment.sourcePort,
        seq: hasAck ? segment.ack : 0,
        ack: hasAck ? 0 : (segment.seq + length) >>> 0,
        flags: hasAck ? TcpFlag.Rst : TcpFlag.Rst | TcpFlag.Ack,
        window: 0
      })
    )
  }

  const dispatch = (packet: Awaited<ReturnType<typeof readIpv6Packet>>) => {
    // The device also sends other packets (next header 0, ICMPv6): only TCP between the two addresses counts.
    const segment =
      packet.nextHeader === NEXT_HEADER_TCP &&
      equalBytes(packet.source, addresses.remote) &&
      equalBytes(packet.destination, addresses.local)
        ? decodeTcpSegment(addresses, packet.payload)
        : undefined
    if (!segment) {
      stats.ignoredPackets++
      return
    }
    const connection = connections.get(segment.destinationPort)
    if (connection) connection.receive(segment)
    else refuse(segment)
  }

  const pump = async (): Promise<void> => {
    try {
      for (;;) dispatch(await readIpv6Packet(link.reader))
    } catch (error) {
      if (!ended) logger.debug('tunnel ended', { cause: error })
      end(
        error instanceof IPAForgeError &&
          error.code === ErrorCode.DeviceProtocolError
          ? error
          : linkLost(error)
      )
    }
  }
  void pump()

  const freePort = (): number => {
    const span = EPHEMERAL_PORT_LAST - EPHEMERAL_PORT_FIRST + 1
    const start = randomU32() % span
    for (let step = 0; step < span; step++) {
      const port = EPHEMERAL_PORT_FIRST + ((start + step) % span)
      if (!connections.has(port)) return port
    }
    throw new IPAForgeError(ErrorCode.DeviceProtocolError, {
      message: 'tunnel: no free local port'
    })
  }

  const connect = (remotePort: number): Promise<Connection> => {
    if (ended) return Promise.reject(ended)
    const localPort = freePort()
    const connection = createTcpConnection(
      {
        localPort,
        remotePort,
        config,
        windowShift,
        stats,
        logger,
        send: (segment, isRetransmit) =>
          write(
            encodeTcpPacket(addresses, {
              ...segment,
              sourcePort: localPort,
              destinationPort: remotePort
            }),
            isRetransmit ? localPort : undefined
          ),
        onFinished: () => {
          if (connections.get(localPort) === connection)
            connections.delete(localPort)
        }
      },
      randomU32()
    )
    connections.set(localPort, connection)

    return connection.connected
  }

  return {
    connect,
    stats,
    close: async () => {
      end(
        new IPAForgeError(ErrorCode.DeviceDisconnected, {
          message: 'tunnel: closed'
        })
      )
      await link.close()
    }
  }
}
