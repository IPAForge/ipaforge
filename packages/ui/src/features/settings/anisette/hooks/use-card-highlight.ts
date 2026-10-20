import { useLocation } from '@tanstack/react-router'
import { type RefObject, useEffect, useState } from 'react'

import {
  ANISETTE_CARD_ID,
  HIGHLIGHT_MS
} from '@ui/features/settings/anisette/constants.ts'

/** Opened from "Choose another anisette server" (`/settings#anisette`): scrolls to the card and outlines it a moment. */
export const useCardHighlight = (
  card: RefObject<HTMLElement | null>
): boolean => {
  const hash = useLocation({ select: (location) => location.hash })
  const [isHighlighted, setIsHighlighted] = useState(false)

  useEffect(() => {
    if (hash !== ANISETTE_CARD_ID) return
    card.current?.scrollIntoView?.({ block: 'start' })
    setIsHighlighted(true)
    const timer = setTimeout(() => setIsHighlighted(false), HIGHLIGHT_MS)

    return () => clearTimeout(timer)
  }, [hash, card])

  return isHighlighted
}
