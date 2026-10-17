/** The five predefined XML entities, by name. */
export const ENTITIES: Readonly<Record<string, string>> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'"
}

/** Markup skipped between elements: processing instructions, comments and the DOCTYPE, with their terminators. */
export const MISC_MARKUP: readonly (readonly [open: string, close: string])[] =
  [
    ['<?', '?>'],
    ['<!--', '-->'],
    ['<!DOCTYPE', '>']
  ]

/** `<real>` spellings of +∞ (matched lower-cased). */
export const POSITIVE_INFINITY_TEXTS: ReadonlySet<string> = new Set([
  'inf',
  '+inf',
  'infinity',
  '+infinity'
])

/** `<real>` spellings of −∞ (matched lower-cased). */
export const NEGATIVE_INFINITY_TEXTS: ReadonlySet<string> = new Set([
  '-inf',
  '-infinity'
])
