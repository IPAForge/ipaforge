import { createContext } from 'react'

import type { Logger } from '@ipaforge/kernel'
import type { EngineClient, UpdateSource } from '@ipaforge/rpc'
import type { PreferencesStore } from '@ui/services/preferences/preferences-store.ts'
import type { ClipboardWriter } from '@ui/services/system/clipboard.ts'
import type { FileSaver } from '@ui/services/system/file-saver.ts'
import type { LinkOpener } from '@ui/services/system/link-opener.ts'
import type { LocaleSource } from '@ui/services/system/locale-source.ts'
import type { ColorSchemeSource } from '@ui/services/system/types.ts'

/** Everything the UI gets from its host, swapped per environment (browser, Electron renderer, tests). */
export type UiServices = {
  /** `App` scopes it to `ui`; features add their own child scope (`ui.theme`, `ui.router`, `ui.i18n`). */
  readonly logger: Logger
  readonly preferences: PreferencesStore
  readonly colorScheme: ColorSchemeSource
  readonly localeSource: LocaleSource
  /** The Engine: over the Electron MessagePort in the desktop app, a fake one over the memory transport elsewhere. */
  readonly engine: EngineClient
  readonly clipboard: ClipboardWriter
  /** Saves text as a file the user keeps (Save in Logs). */
  readonly files: FileSaver
  /**
   * Where a file dropped on the window is, to name it to the Engine. Electron: its real path. A plain browser
   * can't know, so it gives the file's name, which only the fake Engine accepts. Undefined: it can't be used.
   */
  readonly droppedFilePath: (file: File) => string | undefined
  /** Opens a web page in the user's browser. */
  readonly links: LinkOpener
  /** Shown in copied diagnostics, in the sidebar and in What's new. */
  readonly appVersion: string
  /** Updating IPAForge on launch: the main process's updater in the desktop app, idle (or scripted) elsewhere. */
  readonly updates: UpdateSource
}

export const UiServicesContext = createContext<UiServices | undefined>(
  undefined
)
