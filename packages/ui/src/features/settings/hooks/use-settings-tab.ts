import { useLocation } from '@tanstack/react-router'
import { useEffect, useState } from 'react'

import { ANISETTE_CARD_ID } from '@ui/features/settings/anisette/constants.ts'
import type { SettingsTab } from '@ui/features/settings/types.ts'

/** The tab shown: Anisette servers when opened from "Choose another anisette server" (`/settings#anisette`). */
export const useSettingsTab = () => {
  const hash = useLocation({ select: (location) => location.hash })
  const [selected, setSelected] = useState<SettingsTab>(
    hash === ANISETTE_CARD_ID ? 'anisette' : 'general'
  )
  useEffect(() => {
    if (hash === ANISETTE_CARD_ID) setSelected('anisette')
  }, [hash])

  return [selected, setSelected] as const
}
