import type { Socket } from 'node:net'
import type { TLSSocket } from 'node:tls'

export type Stream = Socket | TLSSocket

export type StreamReader = {
  readonly read: () => Promise<Uint8Array | null>
  /** Stops listening (and pauses the stream) so another reader can take over, e.g. after a TLS upgrade. */
  readonly detach: () => void
}

export type Waiter = {
  readonly resolve: (chunk: Uint8Array | null) => void
  readonly reject: (error: unknown) => void
}
