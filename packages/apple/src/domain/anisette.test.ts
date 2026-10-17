import { describe, expect, it } from 'vitest'

import { validateServerUrl } from '@apple/domain/anisette.ts'

describe('validateServerUrl', () => {
  it('normalises the address without its trailing slashes', () => {
    expect(validateServerUrl(' https://ani.sidestore.io/// ')).toEqual({
      ok: true,
      url: 'https://ani.sidestore.io'
    })
    expect(validateServerUrl('https://ani.sidestore.io/v3/')).toEqual({
      ok: true,
      url: 'https://ani.sidestore.io/v3'
    })
  })

  it('rejects other protocols and placeholder hosts', () => {
    expect(validateServerUrl('wss://ani.sidestore.io').ok).toBe(false)
    expect(validateServerUrl('https://yourserver.com').ok).toBe(false)
    expect(validateServerUrl('not a url').ok).toBe(false)
  })

  it('handles a long run of slashes inside the path quickly', () => {
    const path = `${'/'.repeat(100_000)}x`
    const result = validateServerUrl(`https://ani.sidestore.io${path}`)
    expect(result.ok).toBe(true)
  })
})
