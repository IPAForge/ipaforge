// Test-only: an in-memory duplex connection pair.
import type {
  Connection,
  TlsCredentials
} from '@device/domain/ports/transport.ts'

type Queue = {
  push(chunk: Uint8Array | null): void
  pull(): Promise<Uint8Array | null>
}

const createQueue = (): Queue => {
  const chunks: (Uint8Array | null)[] = []
  const waiters: ((chunk: Uint8Array | null) => void)[] = []
  let ended = false

  return {
    push: (chunk) => {
      if (ended) return
      if (chunk === null) ended = true
      const waiter = waiters.shift()
      if (waiter) waiter(chunk)
      else chunks.push(chunk)
    },
    pull: () => {
      if (chunks.length > 0) return Promise.resolve(chunks.shift() ?? null)
      if (ended) return Promise.resolve(null)
      return new Promise((resolve) => waiters.push(resolve))
    }
  }
}

export type Pipe = {
  readonly client: Connection
  readonly server: Connection
  /** Called with the credentials whenever the client upgrades to TLS. */
  onTls(handler: (credentials: TlsCredentials) => void): void
}

export const createPipe = (): Pipe => {
  const toServer = createQueue()
  const toClient = createQueue()
  let tlsHandler: (credentials: TlsCredentials) => void = () => {}
  const close = async () => {
    toServer.push(null)
    toClient.push(null)
  }

  return {
    onTls: (handler) => {
      tlsHandler = handler
    },
    client: {
      read: () => toClient.pull(),
      write: async (bytes) => toServer.push(bytes.slice()),
      startTls: async (credentials) => {
        tlsHandler(credentials)
      },
      close
    },
    server: {
      read: () => toServer.pull(),
      write: async (bytes) => toClient.push(bytes.slice()),
      startTls: async () => {},
      close
    }
  }
}
