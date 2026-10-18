import { describe, expect, it } from 'vitest'

import {
  asIPAForgeError,
  isAbort,
  isTransient
} from '@installer/pipeline/errors.ts'
import { ErrorCode, IPAForgeError } from '@ipaforge/kernel'

describe('pipeline errors', () => {
  it('treats only catalogued network and device errors as transient', () => {
    expect(isTransient(new IPAForgeError(ErrorCode.Offline))).toBe(true)
    expect(isTransient(new IPAForgeError(ErrorCode.DeviceLocked))).toBe(false)
    expect(isTransient(new TypeError('bug'))).toBe(false)
  })

  it('recognises an abort from the signal or the error code', () => {
    const live = new AbortController().signal
    expect(isAbort(new IPAForgeError(ErrorCode.Aborted), live)).toBe(true)
    expect(isAbort(new IPAForgeError(ErrorCode.Offline), live)).toBe(false)
    expect(isAbort(new TypeError('bug'), AbortSignal.abort())).toBe(true)
  })

  it('keeps an IPAForgeError and wraps anything else with the step id', () => {
    const known = new IPAForgeError(ErrorCode.DeviceLocked)
    expect(asIPAForgeError(known, 'upload')).toBe(known)
    const wrapped = asIPAForgeError(new TypeError('bug'), 'upload')
    expect(wrapped.code).toBe(ErrorCode.StepFailed)
    expect(wrapped.data).toEqual({ step: 'upload' })
  })
})
