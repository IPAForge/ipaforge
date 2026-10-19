import type { TranslationKey } from '@ui/i18n/setup/types.ts'

/** Why a link can't be an app source before asking the Engine: not a link, or not https. */
export const sourceUrlProblem = (url: string): TranslationKey | undefined => {
  let parsed: URL

  try {
    parsed = new URL(url.trim())
  } catch {
    return 'preload.addSource.notLink'
  }
  if (parsed.protocol === 'http:') return 'preload.addSource.notHttps'
  if (parsed.protocol !== 'https:') return 'preload.addSource.notLink'
}
