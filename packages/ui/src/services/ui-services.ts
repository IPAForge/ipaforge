import { createContext } from 'react'

import type { Logger } from '@loadstar/kernel'
import type { EngineClient } from '@loadstar/rpc'
import type { PreferencesStore } from '@ui/services/preferences/preferences-store.ts'
import type { ClipboardWriter } from '@ui/services/system/clipboard.ts'
import type { ColorSchemeSource } from '@ui/services/system/color-scheme-source.ts'
import type { LocaleSource } from '@ui/services/system/locale-source.ts'

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
  /** Shown in copied diagnostics. */
  readonly appVersion: string
}

export const UiServicesContext = createContext<UiServices | undefined>(
  undefined
)
