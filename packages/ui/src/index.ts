export { App, type AppProps } from '@ui/App.tsx'
export { prepareLanguage } from '@ui/i18n/setup/prepare-language.ts'
export type { LanguageSetup } from '@ui/i18n/setup/types.ts'
export { createBrowserServices } from '@ui/services/browser-services.ts'
export { consoleLogSink } from '@ui/services/logging/console-log-sink.ts'
export { createLocalStoragePreferences } from '@ui/services/preferences/local-storage-preferences.ts'
export {
  createMemoryPreferencesStore,
  type PreferencesStore
} from '@ui/services/preferences/preferences-store.ts'
export {
  createFixedColorSchemeSource,
  createMediaColorSchemeSource
} from '@ui/services/system/color-scheme-source.ts'
export {
  createFixedLocaleSource,
  createNavigatorLocaleSource,
  type LocaleSource
} from '@ui/services/system/locale-source.ts'
export type {
  ColorScheme,
  ColorSchemeSource
} from '@ui/services/system/types.ts'
export type { UiServices } from '@ui/services/ui-services.ts'
export { palettes } from '@ui/theme/palettes/palettes.ts'
export type {
  ColorMode,
  PaletteId,
  PaletteTokens
} from '@ui/theme/types.ts'
