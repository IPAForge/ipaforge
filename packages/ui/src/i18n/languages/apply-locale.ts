import { directionOf } from '@ui/i18n/languages/languages.ts'

/** Marks `root` (normally `<html>`) with the locale's language and writing direction. */
export const applyLocale = (root: HTMLElement, locale: string): void => {
  root.setAttribute('lang', locale)
  root.setAttribute('dir', directionOf(locale))
}
