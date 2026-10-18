import { AmfiAction } from '@device/infrastructure/amfi/constants.ts'
import type { Link } from '@device/infrastructure/framing/link.ts'
import {
  type FrameLimits,
  receivePlist,
  sendPlist
} from '@device/infrastructure/framing/plist-frames.ts'
import {
  createDict,
  ErrorCode,
  IPAForgeError,
  type Logger
} from '@ipaforge/kernel'

/** Makes Settings › Privacy & Security › Developer Mode visible (it is hidden until a developer tool asks). */
export const revealDeveloperModeOption = async (
  link: Link,
  options: { limits: FrameLimits; logger: Logger }
): Promise<void> => {
  options.logger.debug('amfi: reveal Developer Mode option')
  await sendPlist(
    link,
    createDict([['action', AmfiAction.RevealDeveloperModeOption]])
  )
  const response = await receivePlist(link, options.limits, 'amfi')
  if (response.success !== true) {
    const error =
      typeof response.Error === 'string' ? response.Error : 'unknown'
    throw new IPAForgeError(ErrorCode.ServiceUnavailable, {
      message: `amfi: could not reveal the Developer Mode option: ${error}`,
      data: { amfiError: error }
    })
  }
}
