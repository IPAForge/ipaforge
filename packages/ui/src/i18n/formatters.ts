/** Locale-aware formatting through the standard `Intl` APIs, in the app's default styles. */
export type Formatters = {
  /** "15 Oct 2026" */
  readonly date: (value: Date | number) => string
  /** "15 Oct 2026, 14:05" */
  readonly dateTime: (value: Date | number) => string
  /** "14:05" */
  readonly time: (value: Date | number) => string
  /** "14:05:09.120", for log lines */
  readonly preciseTime: (value: Date | number) => string
  /** "1,234.5" */
  readonly number: (value: number) => string
  /** "28 MB", from a size in bytes */
  readonly fileSize: (bytes: number) => string
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
const TIME: Intl.DateTimeFormatOptions = { timeStyle: 'short' }
const PRECISE_TIME: Intl.DateTimeFormatOptions = {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  fractionalSecondDigits: 3
}
const LIST: Intl.ListFormatOptions = { style: 'long', type: 'conjunction' }
const FILE_SIZE: Intl.NumberFormatOptions = {
  style: 'unit',
  unit: 'megabyte',
  maximumFractionDigits: 1
}
const BYTES_PER_MEGABYTE = 1_000_000
const RELATIVE_TIME: Intl.RelativeTimeFormatOptions = { numeric: 'auto' }

const createFormatters = (locale: string): Formatters => {
  const date = new Intl.DateTimeFormat(locale, DATE)
  const dateTime = new Intl.DateTimeFormat(locale, DATE_TIME)
  const time = new Intl.DateTimeFormat(locale, TIME)
  const preciseTime = new Intl.DateTimeFormat(locale, PRECISE_TIME)
  const number = new Intl.NumberFormat(locale)
  const fileSize = new Intl.NumberFormat(locale, FILE_SIZE)
  const list = new Intl.ListFormat(locale, LIST)
  const relativeTime = new Intl.RelativeTimeFormat(locale, RELATIVE_TIME)

  return {
    date: (value) => date.format(value),
    dateTime: (value) => dateTime.format(value),
    time: (value) => time.format(value),
    preciseTime: (value) => preciseTime.format(value),
    number: (value) => number.format(value),
    fileSize: (bytes) => fileSize.format(bytes / BYTES_PER_MEGABYTE),
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
