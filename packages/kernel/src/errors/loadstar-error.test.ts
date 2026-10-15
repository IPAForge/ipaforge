import { describe, expect, it } from 'vitest'

import { ErrorCode, isErrorCode } from '@kernel/errors/codes.ts'
import {
  isLoadstarError,
  LoadstarError,
  toLoadstarError
} from '@kernel/errors/loadstar-error.ts'

describe('LoadstarError', () => {
  it('carries code, data and cause', () => {
    const cause = new Error('socket closed')
    const error = new LoadstarError(ErrorCode.DeviceLocked, {
      cause,
      data: { udid: 'x' }
    })

    expect(error.code).toBe('device.locked')
    expect(error.data).toEqual({ udid: 'x' })
    expect(error.cause).toBe(cause)
    expect(error.message).toBe('device.locked')
    expect(isLoadstarError(error)).toBe(true)
  })

  it('round-trips through JSON including the cause chain', () => {
    const inner = new LoadstarError(ErrorCode.Offline, {
      message: 'dns failed'
    })
    const outer = new LoadstarError(ErrorCode.AnisetteUnavailable, {
      cause: inner,
      data: { servers: 3 }
    })

    const restored = LoadstarError.fromJSON(JSON.parse(JSON.stringify(outer)))

    expect(restored.code).toBe(ErrorCode.AnisetteUnavailable)
    expect(restored.data).toEqual({ servers: 3 })
    expect(restored.cause).toBeInstanceOf(LoadstarError)
    expect((restored.cause as LoadstarError).code).toBe(ErrorCode.Offline)
    expect((restored.cause as LoadstarError).message).toBe('dns failed')
  })

  it('serializes foreign causes as plain errors', () => {
    const outer = new LoadstarError(ErrorCode.Unexpected, {
      cause: new TypeError('bad')
    })
    const json = outer.toJSON()

    expect(json.cause).toEqual({ name: 'TypeError', message: 'bad' })
    const restored = LoadstarError.fromJSON(json)
    expect((restored.cause as Error).name).toBe('TypeError')
  })

  it('stops serializing absurdly deep cause chains', () => {
    let error: Error = new Error('root')
    for (let i = 0; i < 50; i++)
      error = new Error(`level ${i}`, { cause: error })
    let depth = 0
    for (
      let node = new LoadstarError(ErrorCode.Unexpected, {
        cause: error
      }).toJSON();
      node.cause;
      node = node.cause
    )
      depth++
    expect(depth).toBeLessThanOrEqual(9)
  })
})

describe('toLoadstarError', () => {
  it('returns LoadstarErrors unchanged', () => {
    const error = new LoadstarError(ErrorCode.ZipSlip)
    expect(toLoadstarError(error)).toBe(error)
  })

  it.each([
    ['a string', 'boom', 'boom'],
    ['a number', 42, '42'],
    ['an Error', new Error('kaput'), 'kaput'],
    ['an object', { reason: 'nope' }, '{"reason":"nope"}']
  ])('wraps %s with the fallback code', (_label, thrown, message) => {
    const error = toLoadstarError(thrown, ErrorCode.InvalidMachO)
    expect(error.code).toBe(ErrorCode.InvalidMachO)
    expect(error.cause).toBe(thrown)
    expect(error.message).toBe(message)
  })

  it('maps aborts to internal.aborted', () => {
    const controller = new AbortController()
    controller.abort()
    expect(toLoadstarError(controller.signal.reason).code).toBe(
      ErrorCode.Aborted
    )
  })

  it('defaults to internal.unexpected', () => {
    expect(toLoadstarError(undefined).code).toBe(ErrorCode.Unexpected)
  })
})

describe('isErrorCode', () => {
  it('recognises catalogued codes only', () => {
    expect(isErrorCode('device.locked')).toBe(true)
    expect(isErrorCode('device.unknown')).toBe(false)
    expect(isErrorCode(1)).toBe(false)
  })
})
