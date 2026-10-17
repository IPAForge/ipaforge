import { describe, expect, it } from 'vitest'

import { trimChar, trimEndChar, trimStartChar } from '@kernel/text/trim.ts'

describe('trimEndChar', () => {
  it('removes every trailing occurrence and nothing else', () => {
    expect(trimEndChar('https://a.example///', '/')).toBe('https://a.example')
    expect(trimEndChar('a/b', '/')).toBe('a/b')
    expect(trimEndChar('///', '/')).toBe('')
    expect(trimEndChar('', '/')).toBe('')
  })

  it('stays linear on a long run that is not at the end', () => {
    const hostile = `${'/'.repeat(200_000)}x`
    expect(trimEndChar(hostile, '/')).toBe(hostile)
  })
})

describe('trimStartChar', () => {
  it('removes every leading occurrence and nothing else', () => {
    expect(trimStartChar('//a/b', '/')).toBe('a/b')
    expect(trimStartChar('a/', '/')).toBe('a/')
    expect(trimStartChar('//', '/')).toBe('')
  })
})

describe('trimChar', () => {
  it('removes the runs at both ends', () => {
    expect(trimChar('/a/b/', '/')).toBe('a/b')
    expect(trimChar('//', '/')).toBe('')
    expect(trimChar('a', '/')).toBe('a')
  })
})
