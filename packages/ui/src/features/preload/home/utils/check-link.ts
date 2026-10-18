import type { TranslationKey } from '@ui/i18n/setup/types.ts'

const HTTPS = 'https:'
const IPA = /\.ipa$/i

const parse = (value: string): URL | undefined => {
  try {
    return new URL(value.trim())
  } catch {
    return undefined
  }
}

/** Why a link can't be used: not a link, not https, or not to an .ipa file. Undefined when it can. */
export const linkProblem = (value: string): TranslationKey | undefined => {
  const url = parse(value)
  if (!url) return 'preload.link.invalid'
  if (url.protocol !== HTTPS) return 'preload.link.httpsOnly'
  if (!IPA.test(decodeURIComponent(url.pathname))) return 'preload.link.notIpa'
  return undefined
}

/** The last part of a link's path, for the list until the app is read ("MyApp.ipa"). */
export const linkLabel = (value: string): string => {
  const url = new URL(value.trim())
  const last = url.pathname.split('/').filter(Boolean).pop()

  return last ? decodeURIComponent(last) : url.host
}
