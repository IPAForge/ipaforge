import { useSyncExternalStore } from 'react'

import type { UpdateState } from '@ipaforge/rpc'
import { useUiServices } from '@ui/hooks/use-ui-services.ts'

/** Where updating IPAForge is, as the host reports it. */
export const useUpdateState = (): UpdateState => {
  const { updates } = useUiServices()

  return useSyncExternalStore(
    (onChange) => updates.subscribe(onChange),
    updates.current
  )
}
