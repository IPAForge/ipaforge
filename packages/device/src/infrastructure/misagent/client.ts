import {
  type DeviceProfile,
  summarizeProfile
} from '@device/domain/profiles.ts'
import type { Link } from '@device/infrastructure/framing/link.ts'
import {
  type FrameLimits,
  receivePlist,
  sendPlist
} from '@device/infrastructure/framing/plist-frames.ts'
import { plistInteger } from '@device/infrastructure/framing/plist-values.ts'
import {
  createDict,
  ErrorCode,
  LoadstarError,
  type Logger,
  type PlistDict,
  type PlistValue
} from '@loadstar/kernel'

const PROFILE_TYPE = 'Provisioning'
const STATUS_OK = 0
/** Stands in for a missing or non-integer `Status`, so it reads as a failure. */
const STATUS_UNKNOWN = -1

export type Misagent = {
  /** All provisioning profiles on the device. */
  list(): Promise<DeviceProfile[]>
  install(profile: Uint8Array): Promise<void>
  remove(uuid: string): Promise<void>
  close(): Promise<void>
}

const statusOf = (response: PlistDict): number =>
  plistInteger(response.Status) ?? STATUS_UNKNOWN

const payloads = (response: PlistDict): Uint8Array[] =>
  Array.isArray(response.Payload)
    ? response.Payload.filter((item) => item instanceof Uint8Array)
    : []

const ensureOk = (response: PlistDict, messageType: string): PlistDict => {
  const status = statusOf(response)
  if (status !== STATUS_OK) {
    throw new LoadstarError(ErrorCode.ServiceUnavailable, {
      message: `misagent ${messageType} failed with status ${status}`,
      data: { misagentStatus: status, messageType }
    })
  }
  return response
}

export const createMisagent = (
  link: Link,
  options: { limits: FrameLimits; logger: Logger }
): Misagent => {
  const { limits, logger } = options

  const request = async (
    messageType: string,
    fields: readonly (readonly [string, PlistValue])[] = []
  ) => {
    logger.debug('misagent', { messageType })
    await sendPlist(
      link,
      createDict([
        ['MessageType', messageType],
        ['ProfileType', PROFILE_TYPE],
        ...fields
      ])
    )
    return receivePlist(link, limits, 'misagent')
  }

  const summarize = (raw: Uint8Array): DeviceProfile[] => {
    const profile = summarizeProfile(raw, limits.plist)
    if (profile) return [profile]
    logger.warn('misagent: skipped an unreadable profile', {
      bytes: raw.byteLength
    })
    return []
  }

  return {
    list: async () => {
      // CopyAll (iOS 9.3+) returns every profile; older systems only answer Copy.
      let response = await request('CopyAll')
      if (statusOf(response) !== STATUS_OK) response = await request('Copy')
      return payloads(ensureOk(response, 'CopyAll')).flatMap(summarize)
    },

    install: async (profile) => {
      ensureOk(await request('Install', [['Profile', profile]]), 'Install')
    },

    remove: async (uuid) => {
      ensureOk(await request('Remove', [['ProfileID', uuid]]), 'Remove')
    },

    close: () => link.close()
  }
}
