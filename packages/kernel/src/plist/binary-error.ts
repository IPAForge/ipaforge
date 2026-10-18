import { ErrorCode } from '@kernel/errors/codes.ts'
import { IPAForgeError } from '@kernel/errors/ipaforge-error.ts'
import { compact } from '@kernel/objects/compact.ts'

export const failBinaryPlist = (
  message: string,
  data?: Record<string, unknown>
): never => {
  throw new IPAForgeError(
    ErrorCode.InvalidPlist,
    compact({ message: `binary plist: ${message}`, data })
  )
}
