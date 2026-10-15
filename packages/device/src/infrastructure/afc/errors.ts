import {
  AFC_STATUS_NAMES,
  AFC_STATUS_OBJECT_NOT_FOUND
} from '@device/infrastructure/afc/constants.ts'
import { compact, ErrorCode, LoadstarError } from '@loadstar/kernel'

const statusName = (status: number): string =>
  AFC_STATUS_NAMES[status] ?? String(status)

export const afcStatusError = (
  status: number,
  operation: string,
  path?: string
): LoadstarError =>
  new LoadstarError(ErrorCode.AfcError, {
    message: `AFC ${operation} failed: ${statusName(status)}`,
    data: compact({
      afcStatus: statusName(status),
      operation,
      path: path || undefined
    })
  })

/** The device answered `ObjectNotFound` (the path does not exist). */
export const isObjectNotFound = (error: unknown): boolean =>
  error instanceof LoadstarError &&
  error.data?.afcStatus === AFC_STATUS_NAMES[AFC_STATUS_OBJECT_NOT_FOUND]
