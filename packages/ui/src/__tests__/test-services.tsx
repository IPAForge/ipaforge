import { createMemoryHistory } from '@tanstack/react-router'
import { render } from '@testing-library/react'

import { compact, createLogger, type LogRecord } from '@ipaforge/kernel'
import type { EngineClient, UpdateSource } from '@ipaforge/rpc'
import { App } from '@ui/App.tsx'
import type { LoadBundle } from '@ui/i18n/loading/types.ts'
import { prepareLanguage } from '@ui/i18n/setup/prepare-language.ts'
import { createFakeEngineClient } from '@ui/services/engine/fake/fake-engine-client.ts'
import type {
  FakeDeviceFeed,
  FakeScenarioId
} from '@ui/services/engine/fake/types.ts'
import { createMemoryPreferencesStore } from '@ui/services/preferences/preferences-store.ts'
import { createMemoryClipboard } from '@ui/services/system/clipboard.ts'
import { createMemoryFileSaver } from '@ui/services/system/file-saver.ts'
import { createMemoryLinkOpener } from '@ui/services/system/link-opener.ts'
import { createFixedLocaleSource } from '@ui/services/system/locale-source.ts'
import type {
  ColorScheme,
  ColorSchemeSource
} from '@ui/services/system/types.ts'
import type { UiServices } from '@ui/services/ui-services.ts'
import { createFixedUpdateSource } from '@ui/services/updates/fixed-update-source.ts'
import { GuideKey } from '@ui/state/guide/constants.ts'

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
  /** What the fake Engine plays; the happy path by default. */
  readonly scenario?: FakeScenarioId
  /** The setup guide opens by itself while no Apple ID is saved (off by default in tests). */
  readonly guideOpensByItself?: boolean
  /** Another Engine client, e.g. one whose calls never settle. */
  readonly engine?: EngineClient
  /** The fake Engine's connected devices, for a test that plugs devices in and out. */
  readonly devices?: FakeDeviceFeed
  /** Holds Apple's answers to sign-in requests until the test releases them (default: answer at once). */
  readonly appleAnswer?: () => Promise<void>
  /** The host's updater; idle by default. */
  readonly updates?: UpdateSource
  /** The version the app runs; a test one by default. */
  readonly appVersion?: string
}

const ENGLISH = ['en-US']

/** Services backed by memory, collecting every log record at debug level. */
export const createTestServices = ({
  preferences = {},
  languages = ENGLISH,
  scenario,
  engine,
  devices,
  appleAnswer,
  updates = createFixedUpdateSource(),
  appVersion = '0.0.0-test'
}: TestServicesOptions = {}) => {
  const records: LogRecord[] = []
  const scheme = createControllableScheme('light')
  const clipboard = createMemoryClipboard()
  const links = createMemoryLinkOpener()
  const files = createMemoryFileSaver()
  const services: UiServices = {
    logger: createLogger({
      level: 'debug',
      sink: (record) => records.push(record)
    }),
    // Tests start past the setup guide unless they set its status themselves.
    preferences: createMemoryPreferencesStore({
      [GuideKey.status]: 'finished',
      ...preferences
    }),
    colorScheme: scheme.source,
    localeSource: createFixedLocaleSource(languages),
    engine:
      engine ??
      createFakeEngineClient(
        compact({ scenario, devices, appleAnswer, delayMs: 0, appleDelayMs: 0 })
      ),
    clipboard,
    files,
    droppedFilePath: (file) => file.name,
    links,
    appVersion,
    updates
  }

  return { services, records, scheme, clipboard, files, links }
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
      <App
        services={test.services}
        language={language}
        history={history}
        guideOpensByItself={options.guideOpensByItself ?? false}
      />
    )
  }
}
