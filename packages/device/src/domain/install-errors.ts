// Classifies installation_proxy failures. installd reports a symbolic `Error` plus a description that often
// carries an `0xe800xxxx` code; these decide which recovery the user is shown.

import { INSTALLD_CODE_ERRORS } from '@device/domain/constants.ts'
import { compact, ErrorCode } from '@loadstar/kernel'

const FREE_APP_LIMIT =
  /maximum number of installed apps using a free developer profile/i
const HEX_CODE = /0x[0-9a-f]{8}/i
const BUNDLE_SET = /\{\(([^)]*)\)\}/

export type InstallFailure = {
  readonly code: ErrorCode
  readonly installdCode?: string
  /** For the free-profile limit: the application identifiers iOS counts against it (expired apps included). */
  readonly freeProfileApps?: readonly string[]
}

/** The app identifiers listed in a free-profile-limit description (`{(a, b)}`), if any. */
const freeProfileApps = (
  description: string
): readonly string[] | undefined => {
  const apps = BUNDLE_SET.exec(description)?.[1]
    ?.split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)

  return apps?.length ? apps : undefined
}

/** The first `0xe800xxxx` code, from the description or else the error, lowercased. */
const installdCodeOf = (
  error: string,
  description: string
): string | undefined =>
  HEX_CODE.exec(description)?.[0]?.toLowerCase() ??
  HEX_CODE.exec(error)?.[0]?.toLowerCase()

export const classifyInstallError = (
  error: string,
  description = ''
): InstallFailure => {
  if (FREE_APP_LIMIT.test(description)) {
    return compact({
      code: ErrorCode.FreeAppLimit,
      freeProfileApps: freeProfileApps(description)
    })
  }
  const hex = installdCodeOf(error, description)
  const mapped = hex ? INSTALLD_CODE_ERRORS[hex] : undefined

  return compact({ code: mapped ?? ErrorCode.InstallFailed, installdCode: hex })
}
