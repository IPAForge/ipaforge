import { describe, expect, it } from 'vitest'

import { coachPosition } from '@ui/features/tour/utils/coach-position.ts'

const viewport = { width: 1200, height: 800 }

describe('coachPosition', () => {
  it('puts the note beside a sidebar link, on whichever side has room', () => {
    expect(
      coachPosition({ top: 100, left: 8, width: 240, height: 36 }, viewport)
    ).toEqual({ top: 92, left: 264 })
    // Right to left: the sidebar is on the right, the note goes before it.
    expect(
      coachPosition({ top: 100, left: 952, width: 240, height: 36 }, viewport)
    ).toEqual({ top: 92, left: 616 })
  })

  it('puts it below a top bar button too wide to go beside, inside the window', () => {
    expect(
      coachPosition(
        { top: 8, left: 300, width: 380, height: 36 },
        { width: 700, height: 800 }
      )
    ).toEqual({ top: 60, left: 360 })
  })
})
