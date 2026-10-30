import { describe, expect, it } from 'vitest'

import { sipHash24 } from '@device/domain/remote-pairing/siphash.ts'
import { toHex } from '@ipaforge/kernel'

// The reference test vectors (key 00 01 … 0f, message 00 01 … n-1), output bytes as the reference code writes them.
const KEY = Uint8Array.from({ length: 16 }, (_, index) => index)
const message = (length: number) =>
  Uint8Array.from({ length }, (_, index) => index)

describe('SipHash-2-4', () => {
  it('matches the reference vectors, across a whole block and a partial one', () => {
    expect(toHex(sipHash24(KEY, message(0)))).toBe('310e0edd47db6f72')
    expect(toHex(sipHash24(KEY, message(1)))).toBe('fd67dc93c539f874')
    expect(toHex(sipHash24(KEY, message(7)))).toBe('37d1018bf50002ab')
    expect(toHex(sipHash24(KEY, message(8)))).toBe('6224939a79f5f593')
    expect(toHex(sipHash24(KEY, message(15)))).toBe('e545be4961ca29a1')
    expect(toHex(sipHash24(KEY, message(63)))).toBe('724506eb4c328a95')
  })

  it('refuses a key that is not 16 bytes', () => {
    expect(() => sipHash24(new Uint8Array(8), message(1))).toThrow(RangeError)
  })
})
