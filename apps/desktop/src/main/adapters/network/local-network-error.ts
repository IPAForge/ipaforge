// What a refused local network send looks like: macOS answers with "no route to host" (or "operation not
// permitted") when the user hasn't allowed IPAForge to find devices on the local network.
import { ErrorCode, IPAForgeError } from '@ipaforge/kernel'

const DENIED_CODES = new Set(['EHOSTUNREACH', 'EPERM', 'EACCES'])

/** The error to throw for a failed local network send: `device.local_network_denied` when the OS refused it. */
export const localNetworkError = (
  cause: unknown,
  platform: NodeJS.Platform = process.platform
): IPAForgeError => {
  const code = (cause as { code?: unknown } | undefined)?.code
  const isDenied =
    platform === 'darwin' && typeof code === 'string' && DENIED_CODES.has(code)

  return new IPAForgeError(
    isDenied ? ErrorCode.LocalNetworkDenied : ErrorCode.DeviceDisconnected,
    { cause, data: { code } }
  )
}
