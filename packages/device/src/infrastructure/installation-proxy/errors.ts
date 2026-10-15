import { classifyInstallError } from '@device/domain/install-errors.ts'
import {
  compact,
  LoadstarError,
  type PlistDict,
  stringAt
} from '@loadstar/kernel'

/** A failed installation_proxy command, classified into a catalogued error code. */
export const installProxyError = (
  response: PlistDict,
  command: string,
  subject: string
): LoadstarError => {
  const error = String(response.Error)
  const description = stringAt(response, 'ErrorDescription') || undefined
  const classified = classifyInstallError(error, description)

  return new LoadstarError(classified.code, {
    message: `installation_proxy ${command} failed for ${subject}: ${error}${description ? ` (${description})` : ''}`,
    data: compact({
      installError: error,
      command,
      subject,
      description,
      detail:
        response.ErrorDetail === undefined
          ? undefined
          : String(response.ErrorDetail),
      installdCode: classified.installdCode,
      freeProfileApps: classified.freeProfileApps
    })
  })
}
