import { describe, expect, it } from 'vitest'

import { escapeText, formatDate, formatReal } from '@kernel/plist/xml-format.ts'

describe('XML plist formatting', () => {
  it.each([
    [0.1, '0.10000000000000001'],
    [1000, '1000'],
    [1e-5, '1.0000000000000001e-05'],
    [1e20, '1e+20'],
    [-0, '-0'],
    [Number.NaN, 'nan'],
    [Infinity, '+infinity'],
    [-Infinity, '-infinity']
  ])('formats %d like printf %%.17g', (value, expected) => {
    expect(formatReal(value)).toBe(expected)
  })

  it('drops milliseconds from dates', () => {
    expect(formatDate(new Date('2026-10-15T01:02:03.456Z'))).toBe(
      '2026-10-15T01:02:03Z'
    )
  })

  it('escapes markup characters only', () => {
    expect(escapeText(`a<b>&"c'`)).toBe(`a&lt;b&gt;&amp;"c'`)
  })
})
