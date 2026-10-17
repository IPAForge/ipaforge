import type { i18n } from 'i18next'

import type { Logger } from '@loadstar/kernel'
import type { LanguageId } from '@ui/i18n/languages/types.ts'
import type { MessageTree } from '@ui/i18n/pseudo-locale.ts'

/** Fetches a language's messages. Rejects when the language has no bundle or it can't be fetched. */
export type LoadBundle = (language: LanguageId) => Promise<MessageTree>

export type LocaleLoader = {
  /** Resolves true once `language`'s messages are in i18next (fetched at most once), false if they can't be. */
  ensure: (language: LanguageId) => Promise<boolean>
}

export type LocaleLoaderOptions = {
  readonly i18n: i18n
  readonly load: LoadBundle
  /** Scoped by the caller (`ui.i18n`). */
  readonly logger: Logger
  /** Milliseconds; injectable for tests. */
  readonly now?: () => number
}
