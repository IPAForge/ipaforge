import { describe, expect, it } from 'vitest'

import { escapeText, formatDate, formatReal } from '@kernel/plist/xml-format.ts'

describe('XML plist formatting', () => {
  it.each([
    [0.1, '0.10000000000000001'],
    [1000, '1000'],
    [1.5, '1.5'],
    [-3, '-3'],
    [100.25, '100.25'],
    [12345.678, '12345.678'],
    [1 / 3, '0.33333333333333331'],
    [2.5e-7, '2.4999999999999999e-07'],
    [1e16, '10000000000000000'],
    [1e17, '1e+17'],
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
