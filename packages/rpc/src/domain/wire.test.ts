import { describe, expect, it } from 'vitest'

import { bytesFileSource } from '@ipaforge/kernel'
import { toWire } from '@rpc/domain/wire.ts'

describe('toWire', () => {
  it('drops functions and keeps data a structured clone carries', () => {
    const bytes = new Uint8Array([1, 2])
    const date = new Date(0)
    const value = {
      file: bytesFileSource('a.ipa', bytes),
      profiles: new Map([['com.a', bytes]]),
      list: [{ at: date, run: () => 1 }]
    }

    const wire = toWire(value)

    expect(wire).toEqual({
      file: { name: 'a.ipa', size: 2 },
      profiles: new Map([['com.a', bytes]]),
      list: [{ at: date }]
    })
    expect(() => structuredClone(wire)).not.toThrow()
  })
})
