import { ErrorCode } from '@kernel/errors/codes.ts'
import { IPAForgeError } from '@kernel/errors/ipaforge-error.ts'

export const failXmlPlist = (message: string, position: number): never => {
  throw new IPAForgeError(ErrorCode.InvalidPlist, {
    message: `XML plist: ${message}`,
    data: { position }
  })
}
