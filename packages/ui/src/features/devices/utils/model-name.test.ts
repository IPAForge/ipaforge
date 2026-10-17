import { describe, expect, it } from 'vitest'

import { modelName } from '@ui/features/devices/utils/model-name.ts'

describe('modelName', () => {
  it('names a known model the way people know it', () => {
    expect(modelName('iPhone16,1')).toBe('iPhone 15 Pro')
    expect(modelName('iPhone18,3')).toBe('iPhone 17')
  })

  it('keeps the identifier of a model it doesn’t know', () => {
    expect(modelName('iPhone99,9')).toBe('iPhone99,9')
    expect(modelName('toString')).toBe('toString')
  })
})
