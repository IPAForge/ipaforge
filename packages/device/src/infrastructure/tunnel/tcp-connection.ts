// One TCP client connection (RFC 9293) inside the tunnel, as a `Connection`. The link under the tunnel is a
// reliable byte stream, so loss is rare: it only happens when the device drops a packet. That keeps this simple:
// - sending is limited by the peer's window (scaled, RFC 7323) and our send buffer; no congestion window;
// - every in-order segment is acknowledged at once; out-of-order ones are dropped with a duplicate ACK;
// - loss recovery: a retransmission timer with back-off (RFC 6298 without RTT estimates), fast retransmit on three
//   duplicate ACKs, and, until everything sent before the loss is acknowledged, a retransmit on every partial ACK
//   (NewReno, RFC 6582); after `maxRetransmits` timeouts in a row the connection fails with `device.timeout`;
// - closing sends FIN after the queued data; the connection is forgotten once the FIN is acknowledged.
import type { Connection } from '@device/domain/ports/types.ts'
import {
  TCP_DEFAULT_IPV6_MSS,
  TCP_MAX_WINDOW_FIELD,
  TCP_MAX_WINDOW_SHIFT,
  TCP_PACKET_OVERHEAD,
  TcpFlag
} from '@device/infrastructure/tunnel/constants.ts'
import type {
  TcpConnection,
  TcpConnectionContext,
  TcpSegment
} from '@device/infrastructure/tunnel/types.ts'
import { ErrorCode, IPAForgeError } from '@ipaforge/kernel'

/** Something to send that takes sequence space: data, or a SYN or FIN (one each). */
type Entry = {
  readonly seq: number
  readonly flags: number
  readonly data: Uint8Array
}

const DUPLICATE_ACKS = 3

/** Sequence arithmetic is modulo 2^32 (RFC 9293 §3.4). */
const seqAdd = (seq: number, count: number): number => (seq + count) >>> 0
const seqDiff = (later: number, earlier: number): number =>
  (later - earlier) >>> 0
const seqBefore = (a: number, b: number): boolean => ((a - b) | 0) < 0

/** Sequence space an entry takes: its data, plus one for SYN or FIN. */
const lengthOf = (entry: Entry): number =>
  entry.data.length + (entry.flags & (TcpFlag.Syn | TcpFlag.Fin) ? 1 : 0)
const endOf = (entry: Entry): number => seqAdd(entry.seq, lengthOf(entry))

export const createTcpConnection = (
  ctx: TcpConnectionContext,
  iss: number
): TcpConnection => {
  const { config, stats } = ctx
  const ourMss = config.mtu - TCP_PACKET_OVERHEAD
  let state: 'connecting' | 'open' | 'over' = 'connecting'
  let failure: Error | undefined
  // Sending: every entry not yet acknowledged, in order; the first `sentCount` have been sent.
  const queue: Entry[] = [
    { seq: iss, flags: TcpFlag.Syn, data: new Uint8Array() }
  ]
  let sentCount = 0
  let sndNxt = seqAdd(iss, 1)
  let sendMss = Math.min(ourMss, TCP_DEFAULT_IPV6_MSS)
  let peerWindow = 0
  let peerShift = 0
  let ourShift = 0
  let finQueued = false
  // Loss recovery.
  let rto = config.initialRtoMs
  let timeoutsInARow = 0
  let duplicates = 0
  /** While set, the end of what was sent when a loss was seen: partial ACKs below it retransmit at once. */
  let recoverPoint: number | undefined
  let timer: ReturnType<typeof setTimeout> | undefined
  // Receiving.
  let rcvNxt = 0
  const received: Uint8Array[] = []
  let receivedBytes = 0
  let peerFinished = false
  let lastWindow = config.receiveBufferBytes
  const waiters: (() => void)[] = []

  const wake = (): void => {
    for (const resolve of waiters.splice(0)) resolve()
  }
  const changed = (): Promise<void> =>
    new Promise((resolve) => waiters.push(resolve))

  const sndUna = (): number => queue[0]?.seq ?? sndNxt
  /** One past the last byte sent so far (retransmits never move it back). */
  const sentEnd = (): number => queue[sentCount]?.seq ?? sndNxt
  const inFlight = (): number => seqDiff(sentEnd(), sndUna())
  const queuedBytes = (): number => seqDiff(sndNxt, sndUna())

  const freeWindow = (): number =>
    Math.max(0, config.receiveBufferBytes - receivedBytes)

  /** The window field: unscaled in a SYN, scaled once both sides agreed to (RFC 7323 §2.2). */
  const windowField = (flags: number): number =>
    flags & TcpFlag.Syn
      ? Math.min(TCP_MAX_WINDOW_FIELD, freeWindow())
      : Math.min(TCP_MAX_WINDOW_FIELD, freeWindow() >>> ourShift)

  const send = (entry: Entry, isRetransmit = false): void => {
    const isSyn = (entry.flags & TcpFlag.Syn) !== 0
    lastWindow = freeWindow()
    stats.segmentsOut++
    ctx.send(
      {
        seq: entry.seq,
        flags: isSyn ? entry.flags : entry.flags | TcpFlag.Ack,
        ack: isSyn ? 0 : rcvNxt,
        window: windowField(entry.flags),
        payload: entry.data,
        ...(isSyn
          ? {
              options: {
                maxSegmentSize: ourMss,
                windowShift: ctx.windowShift
              }
            }
          : {})
      },
      isRetransmit
    )
  }

  const sendAck = (): void => {
    lastWindow = freeWindow()
    stats.segmentsOut++
    ctx.send({
      seq: sndNxt,
      flags: TcpFlag.Ack,
      ack: rcvNxt,
      window: windowField(TcpFlag.Ack)
    })
  }

  const stopTimer = (): void => {
    clearTimeout(timer)
    timer = undefined
  }

  const finish = (): void => {
    if (state === 'over') return
    state = 'over'
    stopTimer()
    ctx.onFinished()
    wake()
  }

  let established: (connection: Connection) => void = () => {}
  let refused: (error: Error) => void = () => {}
  const connected = new Promise<Connection>((resolve, reject) => {
    established = resolve
    refused = reject
  })

  const fail = (error: Error): void => {
    if (state === 'connecting') refused(error)
    failure ??= error
    finish()
  }

  const retransmitFirst = (): void => {
    const first = queue[0]
    if (!first || sentCount === 0) return
    stats.retransmits++
    send(first, true)
  }

  /** Sends what the peer's window takes; with nothing in flight, one segment anyway (a window probe). */
  const transmit = (): void => {
    while (sentCount < queue.length) {
      const entry = queue[sentCount] as Entry
      const flight = inFlight()
      if (flight > 0 && flight + lengthOf(entry) > peerWindow) break
      send(entry)
      stats.bytesOut += entry.data.length
      sentCount++
    }
    if (inFlight() > 0) timer ??= setTimeout(onTimeout, rto)
  }

  const restartTimer = (): void => {
    stopTimer()
    if (inFlight() > 0) timer = setTimeout(onTimeout, rto)
  }

  const onTimeout = (): void => {
    timer = undefined
    if (state === 'over' || inFlight() === 0) return
    timeoutsInARow++
    stats.timeouts++
    if (timeoutsInARow > config.maxRetransmits) {
      ctx.logger.debug('tunnel connection gave up', {
        port: ctx.remotePort,
        timeouts: timeoutsInARow
      })
      fail(
        new IPAForgeError(ErrorCode.DeviceTimeout, {
          message: `tunnel: port ${ctx.remotePort} stopped acknowledging (${config.maxRetransmits} retransmissions)`,
          data: { port: ctx.remotePort }
        })
      )
      return
    }
    rto = Math.min(rto * 2, config.maxRtoMs)
    recoverPoint = sentEnd()
    duplicates = 0
    retransmitFirst()
    timer = setTimeout(onTimeout, rto)
  }

  /** Drops what `ack` covers from the send queue (part of the first entry if it lands inside it). */
  const acknowledge = (ack: number): void => {
    while (queue.length > 0 && !seqBefore(ack, endOf(queue[0] as Entry))) {
      queue.shift()
      sentCount = Math.max(0, sentCount - 1)
    }
    const first = queue[0]
    if (first && seqBefore(first.seq, ack) && first.data.length > 0)
      queue[0] = {
        ...first,
        seq: ack,
        data: first.data.subarray(seqDiff(ack, first.seq))
      }
  }

  const onAck = (segment: TcpSegment): void => {
    // An ACK for something never sent is ignored (RFC 9293 §3.10.7.4).
    if (seqBefore(sentEnd(), segment.ack)) return
    const window = segment.window << peerShift
    const windowChanged = window !== peerWindow
    peerWindow = window
    // A closed window the peer keeps answering for is not a dead peer: keep probing as long as it takes.
    if (window === 0) timeoutsInARow = 0
    if (seqBefore(sndUna(), segment.ack)) {
      acknowledge(segment.ack)
      timeoutsInARow = 0
      duplicates = 0
      rto = config.initialRtoMs
      if (recoverPoint !== undefined) {
        if (seqBefore(segment.ack, recoverPoint)) retransmitFirst()
        else recoverPoint = undefined
      }
      restartTimer()
      wake()
    } else if (
      segment.ack === sndUna() &&
      segment.payload.length === 0 &&
      !(segment.flags & TcpFlag.Fin) &&
      !windowChanged &&
      inFlight() > 0
    ) {
      duplicates++
      if (duplicates === DUPLICATE_ACKS && recoverPoint === undefined) {
        recoverPoint = sentEnd()
        retransmitFirst()
      }
    }
    transmit()
  }

  /** Takes in-order data (and FIN); anything else gets a duplicate ACK. */
  const onData = (segment: TcpSegment): void => {
    const hasFin = (segment.flags & TcpFlag.Fin) !== 0
    if (segment.payload.length === 0 && !hasFin) return
    const end = seqAdd(segment.seq, segment.payload.length + (hasFin ? 1 : 0))
    if (!seqBefore(rcvNxt, end) || seqBefore(rcvNxt, segment.seq)) {
      // Already had all of it, or a gap before it.
      sendAck()
      return
    }
    const data = segment.payload.subarray(seqDiff(rcvNxt, segment.seq))
    if (data.length > 0) {
      received.push(data.slice())
      receivedBytes += data.length
      stats.bytesIn += data.length
      rcvNxt = seqAdd(rcvNxt, data.length)
    }
    if (hasFin) {
      rcvNxt = seqAdd(rcvNxt, 1)
      peerFinished = true
    }
    sendAck()
    wake()
  }

  const onSynAck = (segment: TcpSegment): void => {
    const isSynAck =
      (segment.flags & (TcpFlag.Syn | TcpFlag.Ack)) ===
      (TcpFlag.Syn | TcpFlag.Ack)
    if (!isSynAck || segment.ack !== sndNxt) return
    const { maxSegmentSize, windowShift } = segment.options
    // Scaling only when both SYNs carry the option (RFC 7323 §1.3).
    if (windowShift !== undefined) {
      peerShift = Math.min(windowShift, TCP_MAX_WINDOW_SHIFT)
      ourShift = ctx.windowShift
    }
    sendMss = Math.min(ourMss, maxSegmentSize ?? TCP_DEFAULT_IPV6_MSS)
    peerWindow = segment.window
    rcvNxt = seqAdd(segment.seq, 1)
    acknowledge(segment.ack)
    timeoutsInARow = 0
    rto = config.initialRtoMs
    stopTimer()
    state = 'open'
    sendAck()
    established(connection)
  }

  const unusable = (): Error =>
    failure ??
    new IPAForgeError(ErrorCode.DeviceDisconnected, {
      message: `tunnel: the connection to port ${ctx.remotePort} is closed`
    })

  const connection: Connection = {
    read: async () => {
      for (;;) {
        const chunk = received.shift()
        if (chunk) {
          receivedBytes -= chunk.length
          // Tell the peer once the window it last saw has opened up to half the buffer again.
          if (
            state === 'open' &&
            lastWindow < config.receiveBufferBytes / 2 &&
            freeWindow() >= config.receiveBufferBytes / 2
          )
            sendAck()
          return chunk
        }
        if (failure) throw failure
        if (peerFinished || state === 'over' || finQueued) return null
        await changed()
      }
    },
    write: async (bytes) => {
      for (let offset = 0; offset < bytes.length; offset += sendMss) {
        while (state === 'open' && queuedBytes() >= config.sendBufferBytes)
          await changed()
        if (state !== 'open' || finQueued) throw unusable()
        const data = bytes.slice(offset, offset + sendMss)
        queue.push({ seq: sndNxt, flags: TcpFlag.Psh, data })
        sndNxt = seqAdd(sndNxt, data.length)
        transmit()
      }
    },
    startTls: () =>
      Promise.reject(
        new IPAForgeError(ErrorCode.DeviceProtocolError, {
          message: 'no TLS inside the tunnel: it is already encrypted'
        })
      ),
    close: async () => {
      if (state !== 'open' || finQueued) return
      finQueued = true
      queue.push({ seq: sndNxt, flags: TcpFlag.Fin, data: new Uint8Array() })
      sndNxt = seqAdd(sndNxt, 1)
      transmit()
      wake()
    }
  }

  const receive = (segment: TcpSegment): void => {
    stats.segmentsIn++
    if (state === 'over') return
    if (segment.flags & TcpFlag.Rst) {
      fail(
        new IPAForgeError(ErrorCode.DeviceDisconnected, {
          message: `tunnel: the device reset the connection to port ${ctx.remotePort}`,
          data: { port: ctx.remotePort }
        })
      )
      return
    }
    if (state === 'connecting') {
      onSynAck(segment)
      return
    }
    if (segment.flags & TcpFlag.Ack) onAck(segment)
    onData(segment)
    if (finQueued && queue.length === 0) finish()
  }

  send(queue[0] as Entry)
  sentCount = 1
  timer = setTimeout(onTimeout, rto)

  return { connected, receive, fail }
}
