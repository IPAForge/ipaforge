import { describe, expect, it } from 'vitest'

import { createLogger } from '@kernel/logging/create-logger.ts'
import { createLogBuffer } from '@kernel/logging/log-buffer.ts'
import { matchesLogFilter } from '@kernel/logging/log-filter.ts'
import { createLogLevel } from '@kernel/logging/log-level.ts'
import type { LogEntry } from '@kernel/logging/types.ts'
import { fixedClock } from '@kernel/ports/clock.ts'
import type { LogLevel } from '@kernel/ports/types.ts'

const at = (second: number) =>
  `2026-10-18T14:00:${String(second).padStart(2, '0')}.000Z`

const filled = (capacity = 100) => {
  const buffer = createLogBuffer(capacity)
  const levels: LogLevel[] = ['debug', 'info', 'warn', 'error']
  for (let index = 0; index < 20; index++)
    buffer.sink({
      ts: at(index),
      level: levels[index % 4] as LogLevel,
      scope: index % 2 ? 'device.afc' : 'apple',
      msg: `message ${index}`,
      fields: { index }
    })
  return buffer
}

const seqs = (entries: readonly LogEntry[]) => entries.map((e) => e.seq)

describe('createLogBuffer', () => {
  it('numbers entries and returns the newest page oldest first', () => {
    const page = filled().page({ limit: 3 })
    expect(seqs(page.entries)).toEqual([18, 19, 20])
    expect(page.hasMore).toBe(true)
  })

  it('pages up with before until nothing is left', () => {
    const buffer = filled()
    const second = buffer.page({ limit: 15, before: 18 })
    expect(seqs(second.entries)).toEqual(
      [...Array(15).keys()].map((i) => i + 3)
    )
    expect(buffer.page({ limit: 15, before: 3 }).hasMore).toBe(false)
  })

  it('keeps only the newest records up to its capacity', () => {
    const page = filled(5).page({ limit: 100 })
    expect(seqs(page.entries)).toEqual([16, 17, 18, 19, 20])
  })

  it('filters by level, scope, text, time and after, and counts every level', () => {
    const buffer = filled()
    const warnings = buffer.page({ minLevel: 'warn' })
    expect(
      warnings.entries.every((e) => ['warn', 'error'].includes(e.level))
    ).toBe(true)
    expect(warnings.counts).toEqual({ debug: 5, info: 5, warn: 5, error: 5 })
    const device = buffer.page({ scopes: ['device'] })
    expect(device.entries.every((e) => e.scope === 'device.afc')).toBe(true)
    expect(buffer.page({ scopes: ['dev'] }).entries).toEqual([])
    expect(seqs(buffer.page({ text: 'MESSAGE 1' }).entries)).toEqual([
      2, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20
    ])
    expect(seqs(buffer.page({ text: '"index":7' }).entries)).toEqual([8])
    expect(seqs(buffer.page({ from: at(3), to: at(5) }).entries)).toEqual([
      4, 5, 6
    ])
    expect(seqs(buffer.page({ after: 18 }).entries)).toEqual([19, 20])
  })

  it('streams each entry to subscribers until they stop', () => {
    const buffer = createLogBuffer()
    const seen: number[] = []
    const stop = buffer.subscribe((entry) => seen.push(entry.seq))
    buffer.sink({
      ts: at(0),
      level: 'info',
      scope: undefined,
      msg: 'a',
      fields: {}
    })
    stop()
    buffer.sink({
      ts: at(1),
      level: 'info',
      scope: undefined,
      msg: 'b',
      fields: {}
    })
    expect(seen).toEqual([1])
  })

  it('keeps logging when a subscriber throws', () => {
    const buffer = createLogBuffer()
    buffer.subscribe(() => {
      throw new Error('broken reader')
    })
    buffer.sink({
      ts: at(0),
      level: 'info',
      scope: undefined,
      msg: 'a',
      fields: {}
    })
    expect(buffer.page().entries).toHaveLength(1)
  })
})

describe('matchesLogFilter', () => {
  it('applies the whole filter to one live entry', () => {
    const entry: LogEntry = {
      seq: 4,
      ts: at(1),
      level: 'warn',
      scope: 'device.afc',
      msg: 'Upload slow',
      fields: { ms: 900 }
    }
    expect(
      matchesLogFilter(entry, {
        minLevel: 'warn',
        scopes: ['device'],
        text: 'upload'
      })
    ).toBe(true)
    expect(matchesLogFilter(entry, { minLevel: 'error' })).toBe(false)
    expect(matchesLogFilter(entry, { after: 4 })).toBe(false)
  })
})

describe('createLogLevel', () => {
  it('changes what a logger built on it emits, while it runs', () => {
    const buffer = createLogBuffer()
    const level = createLogLevel('info')
    const logger = createLogger({
      level: level.get,
      sink: buffer.sink,
      clock: fixedClock(new Date(at(0)))
    })
    logger.debug('hidden')
    level.set('debug')
    logger.child({ scope: 'child' }).debug('shown')
    expect(buffer.page().entries.map((e) => e.msg)).toEqual(['shown'])
  })
})
