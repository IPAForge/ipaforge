// The pseudo-locale (en-XA): English made visibly foreign, so untranslated and truncated text stands out.
import {
  type MessageFormatElement,
  parse,
  TYPE
} from '@formatjs/icu-messageformat-parser'
import { printAST } from '@formatjs/icu-messageformat-parser/printer.js'

/** About how much longer translations run than English; the padding simulates it. */
const EXPANSION = 0.4
const PADDING = '~'
const OPEN = '['
const CLOSE = ']'

// biome-ignore format: one row per case reads better than 52 lines
const ACCENTED: Readonly<Record<string, string>> = {
  a: "å", b: "ƀ", c: "ç", d: "ð", e: "é", f: "ƒ", g: "ĝ", h: "ĥ", i: "î", j: "ĵ", k: "ķ", l: "ļ", m: "ɱ",
  n: "ñ", o: "ö", p: "þ", q: "ǫ", r: "ŕ", s: "š", t: "ţ", u: "û", v: "ṽ", w: "ŵ", x: "ẋ", y: "ý", z: "ž",
  A: "Å", B: "Ɓ", C: "Ç", D: "Ð", E: "É", F: "Ƒ", G: "Ĝ", H: "Ĥ", I: "Î", J: "Ĵ", K: "Ķ", L: "Ļ", M: "Ṁ",
  N: "Ñ", O: "Ö", P: "Þ", Q: "Ǫ", R: "Ŕ", S: "Š", T: "Ţ", U: "Û", V: "Ṽ", W: "Ŵ", X: "Ẋ", Y: "Ý", Z: "Ž",
};

const accent = (text: string): string =>
  [...text].map((char) => ACCENTED[char] ?? char).join('')

/** Accents literal text only; arguments, plural/select keys, `#` and tag names stay as they are. */
const accentElements = (
  elements: readonly MessageFormatElement[]
): MessageFormatElement[] =>
  elements.map((element) => {
    if (element.type === TYPE.literal)
      return { ...element, value: accent(element.value) }
    if (element.type === TYPE.tag)
      return { ...element, children: accentElements(element.children) }
    if (element.type === TYPE.plural || element.type === TYPE.select) {
      const options = Object.entries(element.options).map(([key, option]) => [
        key,
        { ...option, value: accentElements(option.value) }
      ])

      return { ...element, options: Object.fromEntries(options) }
    }
    return element
  })

/** The visible length of a message: its literal text, counting only the longest branch of a plural or select. */
const visibleLength = (elements: readonly MessageFormatElement[]): number =>
  elements.reduce((total, element) => {
    if (element.type === TYPE.literal) return total + element.value.length
    if (element.type === TYPE.tag)
      return total + visibleLength(element.children)
    if (element.type === TYPE.plural || element.type === TYPE.select) {
      return (
        total +
        Math.max(
          0,
          ...Object.values(element.options).map((option) =>
            visibleLength(option.value)
          )
        )
      )
    }
    return total
  }, 0)

/** "Install {name}" → "[Îñšţåļļ {name}~~~~]": accented, about 40 % longer, bracketed; ICU syntax preserved. */
export const pseudoLocalize = (message: string): string => {
  const elements = parse(message)
  const padding = PADDING.repeat(Math.ceil(visibleLength(elements) * EXPANSION))

  return `${OPEN}${printAST(accentElements(elements))}${padding}${CLOSE}`
}

/** A nested message tree with the same keys and every message pseudo-localised. */
export type MessageTree = { readonly [key: string]: string | MessageTree }

export const pseudoLocalizeTree = (tree: MessageTree): MessageTree =>
  Object.fromEntries(
    Object.entries(tree).map(([key, value]) => [
      key,
      typeof value === 'string'
        ? pseudoLocalize(value)
        : pseudoLocalizeTree(value)
    ])
  )
