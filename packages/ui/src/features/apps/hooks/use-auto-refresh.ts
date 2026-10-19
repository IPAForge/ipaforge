import { useEffect, useRef, useState } from 'react'

import { useAppActions } from '@ui/features/apps/hooks/use-app-actions.ts'
import { useApps } from '@ui/features/apps/hooks/use-apps.ts'
import { dueAt } from '@ui/features/apps/utils/expiry.ts'
import { useRun } from '@ui/hooks/use-run.ts'
import { isRunActive } from '@ui/state/active-run/run-view.ts'

/** setTimeout's longest delay; a later wake-up is split. */
const MAX_TIMER_MS = 2_147_483_647

/**
 * Refreshes apps by themselves while IPAForge is open: when automatic refresh is on, the device and Apple ID are
 * there and no install runs, the apps inside the refresh window are refreshed in one run. No polling: one timer
 * wakes it when the next app enters the window, and new data (a device plugged in, a run ended) wakes it too.
 * Each app is tried once per expiry date, so a failure doesn't loop.
 */
export const useAutoRefresh = () => {
  const { device, account, settings, managed, due } = useApps()
  const { run } = useRun()
  const { refresh } = useAppActions()
  const tried = useRef(new Set<string>())
  // Waking re-renders: the next due time is worked out again, and with it the next timer.
  const [, setWake] = useState(0)
  const isBusy = isRunActive(run?.view)
  const canRun = settings.isOn && device?.isConnected && account && !isBusy
  const fresh = due.filter(
    (view) =>
      !tried.current.has(
        `${view.app.bundleId}:${view.app.expiresAt?.getTime()}`
      )
  )

  useEffect(() => {
    if (!canRun || fresh.length === 0) return
    for (const view of fresh)
      tried.current.add(`${view.app.bundleId}:${view.app.expiresAt?.getTime()}`)
    refresh(fresh)
  }, [canRun, fresh, refresh])

  // Wake up when the next app enters the refresh window.
  const next = managed
    .flatMap((view) =>
      view.app.expiresAt ? [dueAt(view.app.expiresAt, settings.daysBefore)] : []
    )
    .filter((at) => at > Date.now())
    .sort((a, b) => a - b)[0]

  useEffect(() => {
    if (next === undefined || !settings.isOn) return

    const timer = setTimeout(
      () => setWake((count) => count + 1),
      Math.min(MAX_TIMER_MS, next - Date.now())
    )

    return () => clearTimeout(timer)
  }, [next, settings.isOn])
}
