import { fromBase64 } from '@kernel/bytes/base64.ts'
import { utf8Decode } from '@kernel/bytes/bytes.ts'
import { ErrorCode } from '@kernel/errors/codes.ts'
import { LoadstarError } from '@kernel/errors/loadstar-error.ts'
import { DEFAULT_PLIST_LIMITS, type PlistLimits } from '@kernel/plist/limits.ts'
import { createDict, real } from '@kernel/plist/model.ts'
import type {
  ElementParser,
  PlistElement,
  PlistValue,
  Tag,
  XmlReader
} from '@kernel/plist/types.ts'
import { failXmlPlist as fail } from '@kernel/plist/xml-error.ts'
import { createXmlReader } from '@kernel/plist/xml-reader.ts'
import {
  parseDate,
  parseInteger,
  parseReal
} from '@kernel/plist/xml-scalars.ts'

const BYTE_ORDER_MARK = 0xfeff
const PLIST_ELEMENT = 'plist'

/** Text content of a leaf element; a self-closing tag such as `<string/>` is empty. */
const textOf = (reader: XmlReader, tag: Tag): string =>
  tag.selfClosing ? '' : reader.textUntilClose(tag.name)

const parseDict = (
  reader: XmlReader,
  tag: Tag,
  depth: number,
  maxDepth: number
): PlistValue => {
  if (tag.selfClosing) return createDict()
  const entries: [string, PlistValue][] = []
  for (;;) {
    const keyTag = reader.nextTag()
    if (keyTag.closing && keyTag.name === 'dict') return createDict(entries)
    if (keyTag.name !== 'key')
      fail(`expected <key>, got <${keyTag.name}>`, keyTag.start)
    const key = textOf(reader, keyTag)
    entries.push([
      key,
      parseValue(reader, reader.nextTag(), depth + 1, maxDepth)
    ])
  }
}

const parseArray = (
  reader: XmlReader,
  tag: Tag,
  depth: number,
  maxDepth: number
): PlistValue => {
  const items: PlistValue[] = []
  if (tag.selfClosing) return items
  for (;;) {
    const next = reader.nextTag()
    if (next.closing && next.name === 'array') return items
    items.push(parseValue(reader, next, depth + 1, maxDepth))
  }
}

/** `<true/>`, or the long form `<true></true>`. */
const parseBoolean = (reader: XmlReader, tag: Tag): boolean => {
  if (!tag.selfClosing && reader.nextTag().name !== tag.name)
    fail(`malformed <${tag.name}>`, tag.start)
  return tag.name === 'true'
}

/** How each plist element parses; any other element is an error. */
const ELEMENT_PARSERS = {
  dict: parseDict,
  array: parseArray,
  string: (reader, tag) => textOf(reader, tag),
  integer: (reader, tag) => parseInteger(textOf(reader, tag), tag.start),
  real: (reader, tag) => real(parseReal(textOf(reader, tag), tag.start)),
  true: parseBoolean,
  false: parseBoolean,
  data: (reader, tag) => fromBase64(textOf(reader, tag)),
  date: (reader, tag) => parseDate(textOf(reader, tag), tag.start)
} satisfies Record<PlistElement, ElementParser>

const parseValue = (
  reader: XmlReader,
  tag: Tag,
  depth: number,
  maxDepth: number
): PlistValue => {
  if (depth > maxDepth) fail('nesting too deep', tag.start)
  if (tag.closing) fail(`unexpected </${tag.name}>`, tag.start)

  const parse = Object.hasOwn(ELEMENT_PARSERS, tag.name)
    ? ELEMENT_PARSERS[tag.name as PlistElement]
    : undefined
  if (!parse) return fail(`unknown element <${tag.name}>`, tag.start)
  return parse(reader, tag, depth, maxDepth)
}

const decodeInput = (input: Uint8Array | string): string => {
  let xml: string
  try {
    xml = typeof input === 'string' ? input : utf8Decode(input)
  } catch (error) {
    throw new LoadstarError(ErrorCode.InvalidPlist, {
      message: 'XML plist is not valid UTF-8',
      cause: error
    })
  }
  return xml.charCodeAt(0) === BYTE_ORDER_MARK ? xml.slice(1) : xml
}

/**
 * Some Apple payloads (e.g. GrandSlam session data) are a bare value such as `<dict>…</dict>` without the
 * `<plist>` wrapper; CoreFoundation accepts those, so we do too.
 */
const parseBareRoot = (
  reader: XmlReader,
  root: Tag,
  maxDepth: number
): PlistValue => {
  const value = parseValue(reader, root, 0, maxDepth)
  if (!reader.atEnd())
    fail('trailing content after the root value', reader.position())
  return value
}

const parsePlistElement = (
  reader: XmlReader,
  root: Tag,
  maxDepth: number
): PlistValue => {
  if (root.selfClosing) fail('empty <plist>', root.start)
  const value = parseValue(reader, reader.nextTag(), 0, maxDepth)
  const close = reader.nextTag()
  if (!close.closing || close.name !== PLIST_ELEMENT)
    fail('expected </plist>', close.start)
  if (!reader.atEnd())
    fail('trailing content after </plist>', reader.position())
  return value
}

/** Parses an XML property list (bytes must be UTF-8). */
export const parseXmlPlist = (
  input: Uint8Array | string,
  limits: PlistLimits = DEFAULT_PLIST_LIMITS
): PlistValue => {
  const reader = createXmlReader(decodeInput(input))
  const root = reader.nextTag()
  if (root.closing) fail('missing root element', root.start)
  return root.name === PLIST_ELEMENT
    ? parsePlistElement(reader, root, limits.maxDepth)
    : parseBareRoot(reader, root, limits.maxDepth)
}
