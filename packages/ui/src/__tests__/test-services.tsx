import { createMemoryHistory } from '@tanstack/react-router'
import { render } from '@testing-library/react'

import { compact, createLogger, type LogRecord } from '@loadstar/kernel'
import { App } from '@ui/App.tsx'
import type { LoadBundle } from '@ui/i18n/loading/locale-bundles.ts'
import { prepareLanguage } from '@ui/i18n/setup/prepare-language.ts'
import { createMemoryPreferencesStore } from '@ui/services/preferences/preferences-store.ts'
import type {
  ColorScheme,
  ColorSchemeSource
} from '@ui/services/system/color-scheme-source.ts'
import { createFixedLocaleSource } from '@ui/services/system/locale-source.ts'
import type { UiServices } from '@ui/services/ui-services.ts'

/** A colour-scheme source the test can flip, like the OS switching to dark. */
export const createControllableScheme = (initial: ColorScheme) => {
  let scheme = initial
  const listeners = new Set<(scheme: ColorScheme) => void>()
  const source: ColorSchemeSource = {
    current: () => scheme,
    subscribe: (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    }
  }
  const change = (next: ColorScheme) => {
    scheme = next
    for (const listener of listeners) listener(next)
  }

  return { source, change, listenerCount: () => listeners.size }
}

export type TestServicesOptions = {
  /** Saved preferences the app starts with. */
  readonly preferences?: Readonly<Record<string, string>>
  /** The OS languages; English by default. */
  readonly languages?: readonly string[]
  /** Replaces the real (dynamic import) bundle loader, e.g. to delay or fail a load. */
  readonly load?: LoadBundle
}

const ENGLISH = ['en-US']

/** Services backed by memory, collecting every log record at debug level. */
export const createTestServices = ({
  preferences = {},
  languages = ENGLISH
}: TestServicesOptions = {}) => {
  const records: LogRecord[] = []
  const scheme = createControllableScheme('light')
  const services: UiServices = {
    logger: createLogger({
      level: 'debug',
      sink: (record) => records.push(record)
    }),
    preferences: createMemoryPreferencesStore(preferences),
    colorScheme: scheme.source,
    localeSource: createFixedLocaleSource(languages)
  }

  return { services, records, scheme }
}

/** Prepares the language like a host does, then renders the whole app at `path` with in-memory services. */
export const renderApp = async (
  path = '/',
  options: TestServicesOptions = {}
) => {
  const test = createTestServices(options)
  const history = createMemoryHistory({ initialEntries: [path] })
  const language = await prepareLanguage(
    test.services,
    compact({ load: options.load })
  )

  return {
    ...test,
    history,
    language,
    ...render(
      <App services={test.services} language={language} history={history} />
    )
  }
}
