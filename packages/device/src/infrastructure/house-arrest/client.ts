import {
  type AfcClient,
  type AfcClientOptions,
  createAfcClient
} from '@device/infrastructure/afc/client.ts'
import type { Link } from '@device/infrastructure/framing/link.ts'
import {
  type FrameLimits,
  receivePlist,
  sendPlist
} from '@device/infrastructure/framing/plist-frames.ts'
import {
  createDict,
  ErrorCode,
  LoadstarError,
  type Logger
} from '@loadstar/kernel'

/**
 * `documents`: the app's Documents folder (apps with file sharing).
 * `container`: the whole app container (development-signed apps, i.e. everything Loadstar installs).
 */
export type ContainerMode = 'documents' | 'container'

/**
 * Asks house_arrest for an app's container, then talks AFC on the same connection.
 * Paths in the returned client are relative to the container (e.g. `Documents/ALTPairingFile.mobiledevicepairing`).
 */
export const vendContainer = async (
  link: Link,
  bundleId: string,
  mode: ContainerMode,
  options: { limits: FrameLimits; logger: Logger; afc: AfcClientOptions }
): Promise<AfcClient> => {
  const command = mode === 'documents' ? 'VendDocuments' : 'VendContainer'
  options.logger.debug('house_arrest', { command, bundleId })
  await sendPlist(
    link,
    createDict([
      ['Command', command],
      ['Identifier', bundleId]
    ])
  )
  const response = await receivePlist(link, options.limits, 'house_arrest')
  if (typeof response.Error === 'string' || response.Status !== 'Complete') {
    const error =
      typeof response.Error === 'string'
        ? response.Error
        : String(response.Status)
    throw new LoadstarError(ErrorCode.ServiceUnavailable, {
      message: `house_arrest ${command} failed for ${bundleId}: ${error}`,
      data: { houseArrestError: error, bundleId }
    })
  }
  return createAfcClient(link, options.afc)
}
