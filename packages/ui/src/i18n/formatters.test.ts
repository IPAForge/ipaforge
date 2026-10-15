import { describe, expect, it } from 'vitest'

import { formattersFor } from '@ui/i18n/formatters.ts'

const DATE = Date.UTC(2026, 9, 15, 12, 0)

describe('formattersFor', () => {
  it('formats per locale with Intl', () => {
    const en = formattersFor('en')
    const de = formattersFor('de')
    expect(en.number(1234.5)).toBe('1,234.5')
    expect(de.number(1234.5)).toBe('1.234,5')
    expect(en.list(['A', 'B', 'C'])).toBe('A, B, and C')
    expect(de.list(['A', 'B', 'C'])).toBe('A, B und C')
    expect(en.relativeTime(-1, 'day')).toBe('yesterday')
    expect(de.relativeTime(3, 'minute')).toBe('in 3 Minuten')
    expect(en.date(DATE)).toBe('Oct 15, 2026')
    expect(formattersFor('ja').date(DATE)).toBe('2026/10/15')
    expect(formattersFor('ar').number(12)).toBe(
      new Intl.NumberFormat('ar').format(12)
    )
  })

  it("builds a locale's formatters once", () => {
    expect(formattersFor('ru')).toBe(formattersFor('ru'))
    expect(formattersFor('ru')).not.toBe(formattersFor('ro'))
  })
})
