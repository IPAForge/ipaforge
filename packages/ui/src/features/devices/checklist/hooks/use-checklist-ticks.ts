import { useState } from 'react'

import { checklistKey } from '@ui/features/devices/checklist/constants.ts'
import { useUiServices } from '@ui/hooks/use-ui-services.ts'

const readTicks = (saved: string | undefined): Set<string> => {
  try {
    const parsed: unknown = JSON.parse(saved ?? '[]')

    return new Set(
      Array.isArray(parsed)
        ? parsed.filter((id): id is string => typeof id === 'string')
        : []
    )
  } catch {
    return new Set()
  }
}

/** The steps you ticked on a device (only you can see them on the iPhone), kept with the UI preferences. */
export const useChecklistTicks = (udid: string) => {
  const { preferences } = useUiServices()
  const [ticked, setTicked] = useState(() =>
    readTicks(preferences.read(checklistKey(udid)))
  )
  const tick = (id: string, isTicked: boolean) => {
    const next = new Set(ticked)

    if (isTicked) next.add(id)
    else next.delete(id)
    preferences.write(checklistKey(udid), JSON.stringify([...next]))
    setTicked(next)
  }

  return { ticked, tick }
}
