import { ErrorCode } from '@kernel/errors/codes.ts'
import { LoadstarError } from '@kernel/errors/loadstar-error.ts'

export const failXmlPlist = (message: string, position: number): never => {
  throw new LoadstarError(ErrorCode.InvalidPlist, {
    message: `XML plist: ${message}`,
    data: { position }
  })
}
