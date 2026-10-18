import { createLogger, type LogLevel } from '@loadstar/kernel'
import type { EngineClient } from '@loadstar/rpc'
import { consoleLogSink } from '@ui/services/logging/console-log-sink.ts'
import { createLocalStoragePreferences } from '@ui/services/preferences/local-storage-preferences.ts'
import { createNavigatorClipboard } from '@ui/services/system/clipboard.ts'
import { createMediaColorSchemeSource } from '@ui/services/system/color-scheme-source.ts'
import { createWindowLinkOpener } from '@ui/services/system/link-opener.ts'
import { createNavigatorLocaleSource } from '@ui/services/system/locale-source.ts'
import type { UiServices } from '@ui/services/ui-services.ts'

export type BrowserServicesOptions = {
  readonly logLevel: LogLevel
  /** Built by the host: over the memory transport in a browser, over the MessagePort in Electron. */
  readonly engine: (logger: UiServices['logger']) => EngineClient
  readonly appVersion: string
}

/**
 * Services for a browser window (a plain one or the Electron renderer): console logs, localStorage preferences,
 * the OS colour scheme and languages, the clipboard, opening links, and the Engine the host connects.
 */
export const createBrowserServices = (
  host: Window,
  { logLevel, engine, appVersion }: BrowserServicesOptions
): UiServices => {
  const logger = createLogger({ level: logLevel, sink: consoleLogSink })

  return {
    logger,
    preferences: createLocalStoragePreferences(host.localStorage),
    colorScheme: createMediaColorSchemeSource(host.matchMedia.bind(host)),
    localeSource: createNavigatorLocaleSource(host.navigator),
    engine: engine(logger),
    clipboard: createNavigatorClipboard(host.navigator),
    links: createWindowLinkOpener(host),
    appVersion
  }
}
