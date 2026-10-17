// Character trimming without regexes: `/\/+$/` backtracks quadratically on a
// long run of the character followed by anything else, so untrusted input
// (URLs, paths) is trimmed with a plain scan instead.

/** `text` without the run of `char` at its end (`trimEndChar('a//', '/')` → `'a'`). */
export const trimEndChar = (text: string, char: string): string => {
  let end = text.length
  while (end > 0 && text[end - 1] === char) end--

  return text.slice(0, end)
}

/** `text` without the run of `char` at its start (`trimStartChar('//a', '/')` → `'a'`). */
export const trimStartChar = (text: string, char: string): string => {
  let start = 0
  while (start < text.length && text[start] === char) start++

  return text.slice(start)
}

/** `text` without the runs of `char` at both ends. */
export const trimChar = (text: string, char: string): string =>
  trimStartChar(trimEndChar(text, char), char)
