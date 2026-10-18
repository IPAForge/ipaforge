import {
  createLogger,
  isLevelAtLeast,
  type LogLevel,
  type LogRecord
} from '@ipaforge/kernel'
import type { EngineClient } from '@ipaforge/rpc'
import { consoleLogSink } from '@ui/services/logging/console-log-sink.ts'
import { createLocalStoragePreferences } from '@ui/services/preferences/local-storage-preferences.ts'
import { createNavigatorClipboard } from '@ui/services/system/clipboard.ts'
import { createMediaColorSchemeSource } from '@ui/services/system/color-scheme-source.ts'
import { createDownloadFileSaver } from '@ui/services/system/file-saver.ts'
import { createWindowLinkOpener } from '@ui/services/system/link-opener.ts'
import { createNavigatorLocaleSource } from '@ui/services/system/locale-source.ts'
import type { UiServices } from '@ui/services/ui-services.ts'

export type BrowserServicesOptions = {
  readonly logLevel: LogLevel
  /** Built by the host: over the memory transport in a browser, over the MessagePort in Electron. */
  readonly engine: (logger: UiServices['logger']) => EngineClient
  readonly appVersion: string
  /** The Electron renderer's: the real path of a dropped file. Default: its name (for the fake Engine). */
  readonly droppedFilePath?: (file: File) => string | undefined
}

/**
 * Services for a browser window (a plain one or the Electron renderer): console logs, localStorage preferences,
 * the OS colour scheme and languages, the clipboard, opening links, and the Engine the host connects.
 */
export const createBrowserServices = (
  host: Window,
  {
    logLevel,
    engine,
    appVersion,
    droppedFilePath = (file) => file.name
  }: BrowserServicesOptions
): UiServices => {
  // Every record goes to the Engine's log buffer (it keeps those at its own level), so the log viewer shows the
  // UI's lines with the Engine's; the console gets them from `logLevel` up.
  let toEngine: ((record: LogRecord) => void) | undefined
  const logger = createLogger({
    level: 'debug',
    sink: (record) => {
      if (isLevelAtLeast(record.level, logLevel)) consoleLogSink(record)
      toEngine?.(record)
    }
  })
  const client = engine(logger)
  toEngine = client.logs.write

  return {
    logger,
    preferences: createLocalStoragePreferences(host.localStorage),
    colorScheme: createMediaColorSchemeSource(host.matchMedia.bind(host)),
    localeSource: createNavigatorLocaleSource(host.navigator),
    engine: client,
    clipboard: createNavigatorClipboard(host.navigator),
    files: createDownloadFileSaver({ document: host.document, URL }),
    droppedFilePath,
    links: createWindowLinkOpener(host),
    appVersion
  }
}
