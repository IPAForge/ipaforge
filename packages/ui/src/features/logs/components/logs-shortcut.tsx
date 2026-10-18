import { useLogsShortcut } from '@ui/features/logs/hooks/use-logs-shortcut.ts'

/** Listens for the shortcut that opens Logs; renders nothing. Mounted once, by the shell. */
export const LogsShortcut = () => {
  useLogsShortcut()
  return null
}
