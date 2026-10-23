// RSDCheckin: the first exchange on a connection to a lockdown service's shim inside the tunnel. After it, the
// connection speaks that service's usual protocol, without TLS (the tunnel is already encrypted).

import type { Link } from '@device/infrastructure/framing/link.ts'
import {
  type FrameLimits,
  receivePlist,
  sendPlist
} from '@device/infrastructure/framing/plist-frames.ts'
import {
  RSD_CHECKIN_PROTOCOL_VERSION,
  RSD_CHECKIN_REQUEST,
  RSD_START_SERVICE_REPLY
} from '@device/infrastructure/rsd/constants.ts'
import {
  createDict,
  ErrorCode,
  IPAForgeError,
  type PlistDict
} from '@ipaforge/kernel'

/** Checks that `reply` is the expected `Request` echo, and turns an `Error` into `device.service_unavailable`. */
const expectReply = (
  reply: PlistDict,
  request: string,
  service: string
): void => {
  if (typeof reply.Error === 'string')
    throw new IPAForgeError(ErrorCode.ServiceUnavailable, {
      message: `${service} refused the check-in: ${reply.Error}`,
      data: { service, error: reply.Error }
    })
  if (reply.Request !== request)
    throw new IPAForgeError(ErrorCode.DeviceProtocolError, {
      message: `${service}: expected ${request} during the check-in, got ${String(reply.Request)}`,
      data: { service }
    })
}

export type RsdCheckinOptions = {
  readonly label: string
  readonly limits: FrameLimits
  /** The shim's name, for errors and logs. */
  readonly service: string
}

/** Checks in on a fresh shim connection: `RSDCheckin`, its echo, then `StartService`. */
export const rsdCheckin = async (
  link: Link,
  { label, limits, service }: RsdCheckinOptions
): Promise<void> => {
  await sendPlist(
    link,
    createDict([
      ['Label', label],
      ['ProtocolVersion', RSD_CHECKIN_PROTOCOL_VERSION],
      ['Request', RSD_CHECKIN_REQUEST]
    ])
  )
  expectReply(
    await receivePlist(link, limits, `${service} check-in`),
    RSD_CHECKIN_REQUEST,
    service
  )
  expectReply(
    await receivePlist(link, limits, `${service} check-in`),
    RSD_START_SERVICE_REPLY,
    service
  )
}
