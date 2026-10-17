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
 * How long a connection change must last to be noted. A Wi-Fi device drops off and comes back as its screen
 * locks and wakes; a change undone within this time is not worth a note.
 */
const SETTLE_MS = 4000

type NoteKey = 'devices.notes.connected' | 'devices.notes.disconnected'

/**
 * A small note when a device connects or disconnects, never a full-screen error, and only once the change has
 * lasted a few seconds: devices come and go during a cable wiggle or as a Wi-Fi device's screen locks. The name
 * comes from the device's last status; a device never read is "A device". Mounted once, by the shell.
 */
export const DeviceNotes = () => {
  const { t } = useTranslation()
  const engine = useEngine()
  const queryClient = useQueryClient()
  const [queue] = useState(() => new Toast.Queue({ maxVisibleToasts: 2 }))

  useEffect(() => {
    // One pending note per device: a disconnect followed by a reconnect within the settle time cancels both.
    const pending = new Map<string, ReturnType<typeof setTimeout>>()
    const nameOf = (udid: string) =>
      queryClient.getQueryData<DeviceCheck>(queryKeys.deviceStatus(udid))?.info
        .name ?? t('devices.notes.aDevice')
    const later = (udid: string, key: NoteKey) => {
      const waiting = pending.get(udid)
      if (waiting) {
        clearTimeout(waiting)
        pending.delete(udid)
        return
      }
      pending.set(
        udid,
        setTimeout(() => {
          pending.delete(udid)
          queue.add(
            { title: t(key, { name: nameOf(udid) }), variant: 'default' },
            { timeout: NOTE_TIMEOUT_MS }
          )
        }, SETTLE_MS)
      )
    }
    const onEvent = (event: DeviceWatchEvent) => {
      if (event.type === 'detached' && event.udid)
        later(event.udid, 'devices.notes.disconnected')
      if (event.type === 'attached')
        later(event.device.udid, 'devices.notes.connected')
    }
    const stop = engine.watchDevices(onEvent)

    return () => {
      stop()
      for (const timer of pending.values()) clearTimeout(timer)
    }
  }, [engine, queryClient, queue, t])

  return <Toast.Provider queue={queue} placement="bottom end" />
}
