import { createLogger, type LogLevel } from "@loadstar/kernel";
import { createMediaColorSchemeSource } from "@ui/services/color-scheme-source.ts";
import { consoleLogSink } from "@ui/services/console-log-sink.ts";
import { createLocalStoragePreferences } from "@ui/services/local-storage-preferences.ts";
import { createNavigatorLocaleSource } from "@ui/services/locale-source.ts";
import type { UiServices } from "@ui/services/ui-services.ts";

/** Services for a plain browser window: console logs, localStorage preferences, the OS colour scheme and languages. */
export const createBrowserServices = (host: Window, logLevel: LogLevel): UiServices => ({
  logger: createLogger({ level: logLevel, sink: consoleLogSink }),
  preferences: createLocalStoragePreferences(host.localStorage),
  colorScheme: createMediaColorSchemeSource(host.matchMedia.bind(host)),
  localeSource: createNavigatorLocaleSource(host.navigator),
});
