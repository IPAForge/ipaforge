// The fake Engine's log buffer: what it logs while it plays, plus a few lines from "startup". The `logs` scenario
// fills it (3,000 lines) to try paging, search and the virtual list.
import {
  createLogBuffer,
  createLogger,
  createLogLevel,
  type Logger,
  type LogLevel
} from '@ipaforge/kernel'
import type { LogSource } from '@ipaforge/rpc'
import type { FakeScenarioId } from '@ui/services/engine/fake/types.ts'

const FILLED_LINES = 3000
const SCOPES = ['device', 'apple', 'catalog', 'signer', 'installer.run', 'rpc']
const LEVELS: readonly LogLevel[] = ['debug', 'info', 'info', 'info', 'warn']

const seedStartup = (logger: Logger): void => {
  logger.child({ scope: 'desktop' }).info('ready', { platform: 'browser' })
  logger.child({ scope: 'engine' }).info('engine ready', { fake: true })
  logger
    .child({ scope: 'apple' })
    .info('anisette server picked', { server: 'ani.example.net', ms: 341 })
}

const fill = (logger: Logger): void => {
  for (let index = 0; index < FILLED_LINES; index++) {
    const scope = SCOPES[index % SCOPES.length] ?? 'engine'
    const level = LEVELS[index % LEVELS.length] ?? 'info'
    logger
      .child({ scope })
      [level](index % 7 ? 'device status read' : 'request answered', {
        line: index + 1,
        ms: 20 + (index % 300)
      })
  }
}

export type FakeLogs = LogSource & { readonly logger: Logger }

export const createFakeLogs = (scenario: FakeScenarioId): FakeLogs => {
  const buffer = createLogBuffer()
  const level = createLogLevel(scenario === 'logs' ? 'debug' : 'info')
  const logger = createLogger({ level: level.get, sink: buffer.sink })
  seedStartup(logger)
  if (scenario === 'logs') fill(logger)

  return { buffer, level, logger }
}
