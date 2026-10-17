import { Toast } from '@heroui/react'
import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import type { DeviceWatchEvent } from '@loadstar/rpc'
import { queryKeys } from '@ui/hooks/queries/query-keys.ts'
import { useEngine } from '@ui/hooks/use-engine.ts'
import type { DeviceCheck } from '@ui/services/engine/engine-types.ts'

/** How long a note stays: long enough to read, short enough not to pile up while a cable is wiggled. */
const NOTE_TIMEOUT_MS = 3000

/**
 * A small note when a device connects or disconnects, never a full-screen error: devices come and go during a
 * refresh or a cable wiggle. The name comes from the device's status (read when it connects); a device whose
 * status can't be read yet is "A device". Mounted once, by the shell.
 */
export const DeviceNotes = () => {
  const { t } = useTranslation()
  const engine = useEngine()
  const queryClient = useQueryClient()
  const [queue] = useState(() => new Toast.Queue({ maxVisibleToasts: 2 }))

  useEffect(() => {
    const nameOf = (check: DeviceCheck | undefined) =>
      check?.info.name ?? t('devices.notes.aDevice')
    const note = (title: string) =>
      queue.add({ title, variant: 'default' }, { timeout: NOTE_TIMEOUT_MS })
    const onEvent = (event: DeviceWatchEvent) => {
      if (event.type === 'detached') {
        const check = event.udid
          ? queryClient.getQueryData<DeviceCheck>(
              queryKeys.deviceStatus(event.udid)
            )
          : undefined
        note(t('devices.notes.disconnected', { name: nameOf(check) }))
      }
      if (event.type === 'attached') {
        const { udid } = event.device
        queryClient
          .fetchQuery({
            queryKey: queryKeys.deviceStatus(udid),
            queryFn: () => engine.deviceStatus(udid)
          })
          .then(
            (check) =>
              note(t('devices.notes.connected', { name: nameOf(check) })),
            () =>
              note(t('devices.notes.connected', { name: nameOf(undefined) }))
          )
      }
    }

    return engine.watchDevices(onEvent)
  }, [engine, queryClient, queue, t])

  return <Toast.Provider queue={queue} placement="bottom end" />
}
