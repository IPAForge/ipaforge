import { describe, expect, it } from 'vitest'

import {
  asLoadstarError,
  isAbort,
  isTransient
} from '@installer/pipeline/errors.ts'
import { ErrorCode, LoadstarError } from '@loadstar/kernel'

describe('pipeline errors', () => {
  it('treats only catalogued network and device errors as transient', () => {
    expect(isTransient(new LoadstarError(ErrorCode.Offline))).toBe(true)
    expect(isTransient(new LoadstarError(ErrorCode.DeviceLocked))).toBe(false)
    expect(isTransient(new TypeError('bug'))).toBe(false)
  })

  it('recognises an abort from the signal or the error code', () => {
    const live = new AbortController().signal
    expect(isAbort(new LoadstarError(ErrorCode.Aborted), live)).toBe(true)
    expect(isAbort(new LoadstarError(ErrorCode.Offline), live)).toBe(false)
    expect(isAbort(new TypeError('bug'), AbortSignal.abort())).toBe(true)
  })

  it('keeps a LoadstarError and wraps anything else with the step id', () => {
    const known = new LoadstarError(ErrorCode.DeviceLocked)
    expect(asLoadstarError(known, 'upload')).toBe(known)
    const wrapped = asLoadstarError(new TypeError('bug'), 'upload')
    expect(wrapped.code).toBe(ErrorCode.StepFailed)
    expect(wrapped.data).toEqual({ step: 'upload' })
  })
})
