// The fake Engine's runs and device feed, logged the way the real Engine logs them, so the log viewer has the
// same lines to show in the browser.
import type { Logger } from '@ipaforge/kernel'
import {
  type Engine,
  logRunEvent,
  logRunResult,
  type RunHandle
} from '@ipaforge/rpc'

const COMMANDS = [
  'installSideStore',
  'installApps',
  'placePairing',
  'signIn'
] as const

const logged = <S>(
  handle: RunHandle<S>,
  flow: string,
  logger: Logger
): RunHandle<S> => {
  const runLogger = logger.child({ scope: 'installer.run', flow })
  handle.subscribe((event) => logRunEvent(runLogger, event))
  handle.result.then(
    (result) => logRunResult(runLogger, result),
    (error: unknown) => runLogger.error('run broke', { error })
  )
  return handle
}

export const withRunLogging = (engine: Engine, logger: Logger): Engine => {
  const devices = logger.child({ scope: 'device-watch' })
  const commands = Object.fromEntries(
    COMMANDS.map((command) => [
      command,
      (...args: Parameters<Engine[typeof command]>) =>
        logged(
          (engine[command] as (...a: typeof args) => RunHandle<unknown>)(
            ...args
          ),
          command,
          logger
        )
    ])
  )

  return {
    ...engine,
    ...commands,
    watchDevices: (listener, options) =>
      engine.watchDevices((event) => {
        if (event.type !== 'devices')
          devices.info(`device ${event.type}`, {
            connection:
              event.type === 'attached'
                ? event.device.connectionType
                : undefined
          })
        listener(event)
      }, options)
  }
}
