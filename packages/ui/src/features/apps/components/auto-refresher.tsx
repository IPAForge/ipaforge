import { useAutoRefresh } from '@ui/features/apps/hooks/use-auto-refresh.ts'

/** Refreshes apps by themselves, wherever the user is in the app; it shows nothing. */
export const AutoRefresher = () => {
  useAutoRefresh()

  return null
}
