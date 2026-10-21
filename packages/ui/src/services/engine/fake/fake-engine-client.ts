// An EngineClient backed by the fake Engine, over the rpc memory transport: the real server and client, so
// every message is validated and structured-cloned as it would be over the Electron MessagePort.
import { type Logger, silentLogger } from '@ipaforge/kernel'
import {
  createEngineClient,
  createMemoryTransportPair,
  createRpcServer,
  type Engine,
  type EngineClient
} from '@ipaforge/rpc'
import {
  createFakeEngine,
  DEFAULT_DELAY_MS
} from '@ui/services/engine/fake/fake-engine.ts'
import { createFakeLogs } from '@ui/services/engine/fake/fake-logs.ts'
import {
  createFakeResolveIpa,
  FAKE_CHOSEN_IPAS,
  FAKE_SAVE_FOLDER
} from '@ui/services/engine/fake/fake-resolve-ipa.ts'
import type { FakeEngineOptions } from '@ui/services/engine/fake/types.ts'
import { withRunLogging } from '@ui/services/engine/fake/with-run-logging.ts'

export type FakeEngineClientOptions = FakeEngineOptions & {
  readonly logger?: Logger
  /** Replaces some of the fake's methods (tests: no devices, a query that fails). */
  readonly overrides?: Partial<Engine>
}

export const createFakeEngineClient = ({
  logger = silentLogger,
  overrides = {},
  ...options
}: FakeEngineClientOptions = {}): EngineClient => {
  const [serverEnd, clientEnd] = createMemoryTransportPair()
  const { logger: engineLogger, ...logs } = createFakeLogs(
    options.scenario ?? 'happy'
  )
  createRpcServer({
    engine: withRunLogging(
      { ...createFakeEngine(options), ...overrides },
      engineLogger
    ),
    transport: serverEnd,
    resolveIpa: createFakeResolveIpa(options.delayMs ?? DEFAULT_DELAY_MS),
    chooseIpas: async () => FAKE_CHOSEN_IPAS,
    chooseSaveFolder: async () => FAKE_SAVE_FOLDER,
    logs,
    logger: engineLogger
  })

  return createEngineClient(clientEnd, { logger })
}
