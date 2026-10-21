import { useLayoutEffect, useState } from 'react'

import type { Box } from '@ui/features/tour/types.ts'

const measure = (target: string): Box | undefined => {
  const element = document.querySelector(`[data-tour="${target}"]`)
  if (!element) return undefined
  const { top, left, width, height } = element.getBoundingClientRect()

  return { top, left, width, height }
}

/** Where the tour's target is, measured again when the window changes size. */
export const useTargetBox = (target: string): Box | undefined => {
  const [box, setBox] = useState<Box | undefined>(undefined)
  useLayoutEffect(() => {
    const update = () => setBox(measure(target))
    update()
    globalThis.addEventListener('resize', update)

    return () => globalThis.removeEventListener('resize', update)
  }, [target])

  return box
}
