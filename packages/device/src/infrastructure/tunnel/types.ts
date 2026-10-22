import type { Connection } from '@device/domain/ports/types.ts'
import type { Logger } from '@ipaforge/kernel'

/** What the device's CDTunnel handshake answers. Fresh for every tunnel: never stored. */
export type TunnelParameters = {
  /** Our address inside the tunnel. */
  readonly clientAddress: string
  /** The device's address inside the tunnel; RSD and every service listen on it. */
  readonly serverAddress: string
  readonly rsdPort: number
  /** The largest packet the tunnel carries, as the device agreed it. */
  readonly mtu: number
}

/** The two ends' tunnel addresses, 16 bytes each. */
export type TunnelAddresses = {
  readonly local: Uint8Array
  readonly remote: Uint8Array
}

/** The options a SYN carries. */
export type TcpSynOptions = {
  readonly maxSegmentSize?: number
  readonly windowShift?: number
}

export type TcpSegment = {
  readonly sourcePort: number
  readonly destinationPort: number
  readonly seq: number
  readonly ack: number
  readonly flags: number
  /** The raw 16-bit field (scale it with the sender's shift). */
  readonly window: number
  readonly options: TcpSynOptions
  readonly payload: Uint8Array
}

/** A segment to send; ports and addresses are added by the stack. */
export type OutgoingSegment = {
  readonly seq: number
  readonly flags: number
  readonly payload?: Uint8Array
  readonly options?: TcpSynOptions
}

export type TcpConfig = {
  /** Our packet size cap: no packet we send is larger, whatever the tunnel or the peer allows. */
  readonly mtu: number
  /** First retransmission timeout, and the one restored after every acknowledgement. */
  readonly initialRtoMs: number
  readonly maxRtoMs: number
  /** Timeouts in a row without progress before the connection is given up. */
  readonly maxRetransmits: number
  /** Unacknowledged bytes a connection queues before `write` waits. */
  readonly sendBufferBytes: number
  /** Received bytes a connection buffers before its window closes. */
  readonly receiveBufferBytes: number
}

/** Counters over every connection of one stack, for probes and logs. */
export type TcpStats = {
  segmentsOut: number
  segmentsIn: number
  bytesOut: number
  bytesIn: number
  retransmits: number
  timeouts: number
  /** Packets that weren't TCP between the two tunnel addresses, or failed their checksum. */
  ignoredPackets: number
}

/** One connection's side of the stack: how it sends, and the counters it adds to. */
export type TcpConnectionContext = {
  readonly localPort: number
  readonly remotePort: number
  readonly config: TcpConfig
  /** Our receive-window shift, offered in the SYN. */
  readonly windowShift: number
  readonly stats: TcpStats
  readonly logger: Logger
  /** Queues a segment; a retransmission goes out before anything else waiting. */
  send(
    segment: OutgoingSegment & {
      readonly ack: number
      readonly window: number
    },
    isRetransmit?: boolean
  ): void
  /** The connection is over (closed both ways, reset or given up): the stack forgets its port. */
  onFinished(): void
}

/** A connection plus what the stack feeds it. */
export type TcpConnection = {
  /** Resolves once established; rejects when the device refuses or never answers. */
  readonly connected: Promise<Connection>
  receive(segment: TcpSegment): void
  /** The tunnel is gone: everything waiting fails with `error`. */
  fail(error: Error): void
}

/** A userspace TCP client inside one tunnel: connections to ports on the device. */
export type TcpStack = {
  connect(port: number): Promise<Connection>
  readonly stats: Readonly<TcpStats>
  /** Ends every connection and closes the tunnel's link. */
  close(): Promise<void>
}
