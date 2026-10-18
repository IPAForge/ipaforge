import { useLocation, useNavigate } from '@tanstack/react-router'
import { useEffect, useRef } from 'react'

import { homePath } from '@ui/sections.ts'
import type { SectionPath } from '@ui/types.ts'

const LOGS_PATH: SectionPath = '/logs'
const SHORTCUT_KEY = 'l'

/** Ctrl+L (⌘L on macOS) opens Logs from any section; on Logs it goes back to where the user was. */
export const useLogsShortcut = () => {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const cameFrom = useRef<string>(homePath)

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const isShortcut =
        (event.ctrlKey || event.metaKey) &&
        !event.altKey &&
        !event.shiftKey &&
        event.key.toLowerCase() === SHORTCUT_KEY
      if (!isShortcut) return
      event.preventDefault()
      if (pathname === LOGS_PATH) {
        void navigate({ to: cameFrom.current })
        return
      }
      cameFrom.current = pathname
      void navigate({ to: LOGS_PATH })
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [navigate, pathname])
}
