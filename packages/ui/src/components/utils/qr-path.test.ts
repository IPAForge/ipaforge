import { describe, expect, it } from 'vitest'

import { qrPath } from '@ui/components/utils/qr-path.ts'

describe('qrPath', () => {
  it('draws the same code for the same text, with a margin around it', () => {
    const link = 'sidestore://source?url=https%3A%2F%2Fexample.com%2Fapps.json'
    const first = qrPath(link)

    expect(first).toEqual(qrPath(link))
    expect(first.size).toBeGreaterThanOrEqual(25)
    // The margin is light: no square starts in the first two rows or columns.
    expect(first.path).not.toMatch(/M[01] /)
    expect(first.path).not.toMatch(/M\d+ [01]h/)
  })
})
