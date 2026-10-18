import type { NewPreloadItem } from '@ui/state/preload/types.ts'

const IPA = /\.ipa$/i

/** A dropped file as a list item: an .ipa with its path, or turned away (not an app, or no path to read). */
export const itemFromFile = (
  file: { readonly name: string; readonly size: number },
  path: string | undefined
): NewPreloadItem => {
  const base = { label: file.name, size: file.size }
  if (!IPA.test(file.name)) return { ...base, refused: 'not-ipa' }
  if (!path) return { ...base, refused: 'unreadable' }
  return { ...base, source: { kind: 'file', path } }
}
