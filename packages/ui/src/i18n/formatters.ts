/** Locale-aware formatting through the standard `Intl` APIs, in the app's default styles. */
export type Formatters = {
  /** "15 Oct 2026" */
  readonly date: (value: Date | number) => string
  /** "15 Oct 2026, 14:05" */
  readonly dateTime: (value: Date | number) => string
  /** "1,234.5" */
  readonly number: (value: number) => string
  /** "A, B and C" */
  readonly list: (items: readonly string[]) => string
  /** "3 minutes ago", "in 2 days", "yesterday" */
  readonly relativeTime: (
    value: number,
    unit: Intl.RelativeTimeFormatUnit
  ) => string
}

const DATE: Intl.DateTimeFormatOptions = { dateStyle: 'medium' }
const DATE_TIME: Intl.DateTimeFormatOptions = {
  dateStyle: 'medium',
  timeStyle: 'short'
}
const LIST: Intl.ListFormatOptions = { style: 'long', type: 'conjunction' }
const RELATIVE_TIME: Intl.RelativeTimeFormatOptions = { numeric: 'auto' }

const createFormatters = (locale: string): Formatters => {
  const date = new Intl.DateTimeFormat(locale, DATE)
  const dateTime = new Intl.DateTimeFormat(locale, DATE_TIME)
  const number = new Intl.NumberFormat(locale)
  const list = new Intl.ListFormat(locale, LIST)
  const relativeTime = new Intl.RelativeTimeFormat(locale, RELATIVE_TIME)

  return {
    date: (value) => date.format(value),
    dateTime: (value) => dateTime.format(value),
    number: (value) => number.format(value),
    list: (items) => list.format(items),
    relativeTime: (value, unit) => relativeTime.format(value, unit)
  }
}

const cache = new Map<string, Formatters>()

/** The formatters for `locale`, built once per locale: constructing `Intl` formatters is costly. */
export const formattersFor = (locale: string): Formatters => {
  const cached = cache.get(locale)
  if (cached) return cached
  const created = createFormatters(locale)
  cache.set(locale, created)
  return created
}
