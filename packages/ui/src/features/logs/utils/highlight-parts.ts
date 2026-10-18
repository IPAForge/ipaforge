export type HighlightPart = { readonly text: string; readonly isMatch: boolean }

/** `text` split around every case-insensitive occurrence of `query`, scanned by hand (no regex on user input). */
export const highlightParts = (
  text: string,
  query: string
): readonly HighlightPart[] => {
  const needle = query.trim().toLowerCase()
  if (!needle) return [{ text, isMatch: false }]
  const haystack = text.toLowerCase()
  const parts: HighlightPart[] = []
  let start = 0
  let found = haystack.indexOf(needle)
  while (found !== -1) {
    if (found > start)
      parts.push({ text: text.slice(start, found), isMatch: false })
    parts.push({
      text: text.slice(found, found + needle.length),
      isMatch: true
    })
    start = found + needle.length
    found = haystack.indexOf(needle, start)
  }
  if (start < text.length)
    parts.push({ text: text.slice(start), isMatch: false })
  return parts
}
