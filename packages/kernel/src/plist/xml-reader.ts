import { failXmlPlist as fail } from '@kernel/plist/xml-error.ts'

const ENTITIES: Readonly<Record<string, string>> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'"
}
const ENTITY_PATTERN = /&(#x[0-9a-f]+|#[0-9]+|[a-z]+);/gi
const MAX_CODE_POINT = 0x10ffff

const CDATA_OPEN = '<![CDATA['
const CDATA_CLOSE = ']]>'

/** Markup skipped between elements: processing instructions, comments and the DOCTYPE, with their terminators. */
const MISC_MARKUP: readonly (readonly [open: string, close: string])[] = [
  ['<?', '?>'],
  ['<!--', '-->'],
  ['<!DOCTYPE', '>']
]

const decodeCharacterReference = (entity: string, position: number): string => {
  const isHex = entity[1] === 'x' || entity[1] === 'X'
  const code = isHex
    ? Number.parseInt(entity.slice(2), 16)
    : Number(entity.slice(1))
  if (!Number.isFinite(code) || code > MAX_CODE_POINT)
    return fail(`bad character reference &${entity};`, position)
  return String.fromCodePoint(code)
}

const decodeEntities = (text: string, position: number): string =>
  text.replace(ENTITY_PATTERN, (_match, entity: string) => {
    if (entity[0] === '#') return decodeCharacterReference(entity, position)
    return ENTITIES[entity] ?? fail(`unknown entity &${entity};`, position)
  })

export type Tag = {
  readonly name: string
  readonly closing: boolean
  readonly selfClosing: boolean
  readonly start: number
  readonly end: number
}

/** Minimal, strict XML reader for the plist DTD (no attributes are interpreted). */
export const createXmlReader = (xml: string) => {
  let pos = 0

  const indexAfter = (token: string): number => {
    const index = xml.indexOf(token, pos)

    return index < 0 ? fail(`unterminated ${token}`, pos) : index + token.length
  }

  const skipWhitespace = (): void => {
    while (pos < xml.length && /\s/.test(xml[pos] as string)) pos++
  }

  const skipMisc = (): void => {
    for (;;) {
      skipWhitespace()
      const markup = MISC_MARKUP.find(([open]) => xml.startsWith(open, pos))
      if (!markup) return
      pos = indexAfter(markup[1])
    }
  }

  const nextTag = (): Tag => {
    skipMisc()
    if (xml[pos] !== '<') fail('expected a tag', pos)
    const start = pos
    const end = indexAfter('>')
    const inner = xml.slice(start + 1, end - 1).trim()
    const closing = inner.startsWith('/')
    const selfClosing = inner.endsWith('/')
    const name =
      inner.replace(/^\//, '').replace(/\/$/, '').split(/\s+/)[0] ?? ''
    pos = end
    return { name, closing, selfClosing, start, end }
  }

  const readCdata = (): string => {
    const end = xml.indexOf(CDATA_CLOSE, pos)
    if (end < 0) fail('unterminated CDATA', pos)
    const text = xml.slice(pos + CDATA_OPEN.length, end)
    pos = end + CDATA_CLOSE.length
    return text
  }

  /** Raw text up to the closing tag `</name>` (CDATA sections are supported). */
  const textUntilClose = (name: string): string => {
    const close = `</${name}>`
    let out = ''
    for (;;) {
      if (xml.startsWith(CDATA_OPEN, pos)) {
        out += readCdata()
        continue
      }
      const next = xml.indexOf('<', pos)
      if (next < 0) fail(`missing ${close}`, pos)
      out += decodeEntities(xml.slice(pos, next), pos)
      pos = next
      if (xml.startsWith(close, pos)) {
        pos += close.length
        return out
      }
      if (!xml.startsWith(CDATA_OPEN, pos))
        fail(`unexpected markup inside <${name}>`, pos)
    }
  }

  const atEnd = (): boolean => {
    skipMisc()
    return pos >= xml.length
  }

  return { nextTag, textUntilClose, skipMisc, position: () => pos, atEnd }
}

export type XmlReader = ReturnType<typeof createXmlReader>
