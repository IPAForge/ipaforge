import { COACH_GAP, COACH_WIDTH } from '@ui/features/tour/constants.ts'
import type { Box } from '@ui/features/tour/types.ts'

const COACH_HEIGHT = 220

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(value, max))

/**
 * Where the note goes: beside its target on the side with room (a sidebar link, whichever side the sidebar is on),
 * otherwise below it (the top bar), kept inside the window.
 */
export const coachPosition = (
  target: Box,
  viewport: { readonly width: number; readonly height: number }
): { readonly top: number; readonly left: number } => {
  const roomAfter = viewport.width - (target.left + target.width)
  const roomBefore = target.left
  const needed = COACH_WIDTH + 2 * COACH_GAP
  const maxLeft = viewport.width - COACH_WIDTH - COACH_GAP
  const top = clamp(target.top - 8, COACH_GAP, viewport.height - COACH_HEIGHT)
  if (roomAfter >= needed)
    return { top, left: target.left + target.width + COACH_GAP }
  if (roomBefore >= needed)
    return { top, left: target.left - COACH_WIDTH - COACH_GAP }

  return {
    top: target.top + target.height + COACH_GAP,
    left: clamp(target.left + target.width - COACH_WIDTH, COACH_GAP, maxLeft)
  }
}
