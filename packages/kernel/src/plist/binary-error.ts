import { ErrorCode } from '@kernel/errors/codes.ts'
import { LoadstarError } from '@kernel/errors/loadstar-error.ts'
import { compact } from '@kernel/objects/compact.ts'

export const failBinaryPlist = (
  message: string,
  data?: Record<string, unknown>
): never => {
  throw new LoadstarError(
    ErrorCode.InvalidPlist,
    compact({ message: `binary plist: ${message}`, data })
  )
}
