import { describe, expect, it } from 'vitest'

import {
  clampFraction,
  createProgress,
  totalWeight
} from '@installer/pipeline/progress.ts'
import type { Step } from '@installer/pipeline/types.ts'
import { compact } from '@ipaforge/kernel'

const step = (weight?: number): Step<unknown> =>
  compact({ id: 's', labelKey: 's', weight, run: async () => undefined })

describe('progress', () => {
  it('sums step weights with a default of 1 and never returns 0', () => {
    expect(totalWeight([step(), step(3)])).toBe(4)
    expect(totalWeight([])).toBe(1)
  })

  it('clamps fractions to 0–1', () => {
    expect(clampFraction(-0.5)).toBe(0)
    expect(clampFraction(0.25)).toBe(0.25)
    expect(clampFraction(2)).toBe(1)
  })

  it('accumulates finished weight and reports progress within the current step', () => {
    const progress = createProgress(4)
    expect(progress.complete(1)).toBe(0.25)
    expect(progress.within(3, 0.5)).toBe(0.625)
    expect(progress.complete(3)).toBe(1)
  })
})
