import { LOG_FILE_PREFIX } from '@ui/features/logs/constants.ts'

const pad = (value: number) => String(value).padStart(2, '0')

/** `ipaforge-logs-2026-10-18-1402.log`, in local time, so files sort by when they were saved. */
export const logFileName = (at: Date): string =>
  `${LOG_FILE_PREFIX}-${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}-${pad(at.getHours())}${pad(at.getMinutes())}.log`
