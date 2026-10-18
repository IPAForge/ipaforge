// The host's EngineClient with every query and command logged at debug level (scope `ui.engine`): the method and,
// for a failed query, the error code. Arguments are never logged; an answer or input may hold a secret.
import { type Logger, toLoadstarError } from '@loadstar/kernel'
import type { EngineClient } from '@loadstar/rpc'

type AnyMethod = (...args: unknown[]) => unknown

const logged = (method: string, call: AnyMethod, logger: Logger): AnyMethod => {
  return (...args) => {
    logger.debug('engine request', { method })
    const value = call(...args)
    if (value instanceof Promise)
      value.catch((error: unknown) =>
        logger.debug('engine request failed', {
          method,
          code: toLoadstarError(error).code
        })
      )
    return value
  }
}

/** Left as they are: `classify` runs locally, and the log viewer's own traffic would fill the log it reads. */
const UNLOGGED = new Set(['classify', 'logs'])

export const withRequestLogging = (
  engine: EngineClient,
  logger: Logger
): EngineClient => {
  const log = logger.child({ scope: 'engine' })

  return Object.fromEntries(
    Object.entries(engine).map(([method, call]) => [
      method,
      UNLOGGED.has(method) ? call : logged(method, call as AnyMethod, log)
    ])
  ) as EngineClient
}
