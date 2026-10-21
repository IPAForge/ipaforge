import type { HostSystem } from '@ui/features/guide/types.ts'

/** The system IPAForge runs on, from the browser's user agent (the desktop app's renderer says it too). */
export const hostSystem = (userAgent: string): HostSystem => {
  if (/windows/i.test(userAgent)) return 'windows'
  if (/linux|x11/i.test(userAgent) && !/android/i.test(userAgent))
    return 'linux'

  return 'mac'
}
