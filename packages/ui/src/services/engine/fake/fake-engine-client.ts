// An EngineClient backed by the fake Engine, over the rpc memory transport: the real server and client, so
// every message is validated and structured-cloned as it would be over the Electron MessagePort.
import {
  ErrorCode,
  LoadstarError,
  type Logger,
  silentLogger
} from '@loadstar/kernel'
import {
  createEngineClient,
  createMemoryTransportPair,
  createRpcServer,
  type Engine,
  type EngineClient
} from '@loadstar/rpc'
import { createFakeEngine } from '@ui/services/engine/fake/fake-engine.ts'
import type { FakeEngineOptions } from '@ui/services/engine/fake/types.ts'

export type FakeEngineClientOptions = FakeEngineOptions & {
  readonly logger?: Logger
  /** Replaces some of the fake's methods (tests: no devices, a query that fails). */
  readonly overrides?: Partial<Engine>
}

/** Imported IPAs come with Phase 9's file dialogs; the fake has nothing to open. */
const noIpas = async () => {
  throw new LoadstarError(ErrorCode.InvalidBundle, {
    message: 'the fake Engine opens no IPAs'
  })
}

export const createFakeEngineClient = ({
  logger = silentLogger,
  overrides = {},
  ...options
}: FakeEngineClientOptions = {}): EngineClient => {
  const [serverEnd, clientEnd] = createMemoryTransportPair()
  createRpcServer({
    engine: { ...createFakeEngine(options), ...overrides },
    transport: serverEnd,
    resolveIpa: noIpas,
    logger
  })

  return createEngineClient(clientEnd, { logger })
}
