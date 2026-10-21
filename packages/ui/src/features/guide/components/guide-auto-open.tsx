import { useEffect, useRef } from 'react'

import { useAccounts } from '@ui/hooks/queries/use-accounts.ts'
import { useGuide } from '@ui/hooks/use-guide.ts'

/** Opens the setup guide at launch when no Apple ID is saved: once, when the saved Apple IDs are first read. */
export const GuideAutoOpen = () => {
  const { guide, open, opensByItself } = useGuide()
  const accounts = useAccounts().data
  const hasChecked = useRef(false)
  const shouldOpen =
    opensByItself &&
    !hasChecked.current &&
    accounts?.length === 0 &&
    guide.status !== 'open'
  useEffect(() => {
    if (accounts === undefined || hasChecked.current) return
    hasChecked.current = true
    if (shouldOpen) open()
  }, [accounts, shouldOpen, open])

  return null
}
