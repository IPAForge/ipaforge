import { USBMUX_LIB_VERSION, UsbmuxResult } from '@device/domain/constants.ts'
import { shortUdid } from '@device/domain/device.ts'
import type { DeviceEvent, UsbmuxDevice } from '@device/domain/types.ts'
import { closeOnError } from '@device/infrastructure/closeable.ts'
import { createLink, type Link } from '@device/infrastructure/framing/link.ts'
import {
  RESULT_ERRORS,
  RESULT_UNKNOWN
} from '@device/infrastructure/usbmux/constants.ts'
import {
  encodeUsbmuxPacket,
  readUsbmuxPacket,
  toNetworkPort
} from '@device/infrastructure/usbmux/protocol.ts'
import {
  buidResponseSchema,
  deviceListSchema,
  eventSchema,
  pairRecordResponseSchema,
  resultSchema,
  toUsbmuxDevice
} from '@device/infrastructure/usbmux/schemas.ts'
import type {
  UsbmuxClient,
  UsbmuxClientOptions
} from '@device/infrastructure/usbmux/types.ts'
import {
  compact,
  createDict,
  ErrorCode,
  IPAForgeError,
  type PlistDict
} from '@ipaforge/kernel'

const resultError = (number: number, what: string): IPAForgeError =>
  new IPAForgeError(
    RESULT_ERRORS.get(number) ?? ErrorCode.DeviceProtocolError,
    {
      message: `usbmuxd ${what} failed with result ${number}`,
      data: { result: number }
    }
  )

const expectOk = (response: PlistDict, what: string): void => {
  const parsed = resultSchema.safeParse(response)
  const number = parsed.success ? parsed.data.Number : RESULT_UNKNOWN
  if (number !== UsbmuxResult.Ok) throw resultError(number, what)
}

/** Prefer USB over network when the same device is visible both ways. */
export const preferUsb = (devices: readonly UsbmuxDevice[]): UsbmuxDevice[] => {
  const byUdid = new Map<string, UsbmuxDevice>()
  for (const device of devices) {
    const existing = byUdid.get(device.udid)
    if (
      !existing ||
      (existing.connectionType === 'network' && device.connectionType === 'usb')
    ) {
      byUdid.set(device.udid, device)
    }
  }
  return [...byUdid.values()]
}

export const createUsbmuxClient = (
  options: UsbmuxClientOptions
): UsbmuxClient => {
  const { transport, logger, label, limits } = options
  let nextTag = 1

  const open = async (): Promise<Link> => {
    try {
      return createLink(await transport.connectUsbmux())
    } catch (error) {
      if (error instanceof IPAForgeError) throw error
      throw new IPAForgeError(ErrorCode.UsbmuxdUnavailable, { cause: error })
    }
  }

  const request = async (
    link: Link,
    messageType: string,
    fields: PlistDict = createDict()
  ): Promise<PlistDict> => {
    const tag = nextTag++
    const message = createDict([
      ['MessageType', messageType],
      ['ProgName', label],
      ['ClientVersionString', label],
      ['kLibUSBMuxVersion', USBMUX_LIB_VERSION],
      ...Object.entries(fields)
    ])
    logger.debug('usbmux request', { messageType, tag })
    await link.write(encodeUsbmuxPacket(tag, message))
    for (;;) {
      const packet = await readUsbmuxPacket(link, limits)
      if (packet.tag === tag) return packet.message
      logger.debug('usbmux: skipped packet with another tag', {
        tag: packet.tag
      })
    }
  }

  /** One request on a short-lived connection. */
  const oneShot = async (
    messageType: string,
    fields?: PlistDict
  ): Promise<PlistDict> => {
    const link = await open()
    try {
      return await request(link, messageType, fields)
    } finally {
      await link.close()
    }
  }

  /** Tracks attached devices so a `Detached` event (which carries only the device ID) can name its UDID. */
  const eventDispatcher = (onEvent: (event: DeviceEvent) => void) => {
    const known = new Map<number, string>()

    return (message: PlistDict): void => {
      const event = eventSchema.safeParse(message)
      if (!event.success) {
        logger.debug('usbmux: ignored event', {
          messageType: message.MessageType
        })
        return
      }
      if (event.data.MessageType === 'Attached') {
        const device = toUsbmuxDevice(
          event.data.Properties,
          event.data.DeviceID
        )
        known.set(device.deviceId, device.udid)
        logger.info('device attached', {
          device: shortUdid(device.udid),
          connectionType: device.connectionType
        })
        onEvent({ kind: 'attached', device })
      } else if (event.data.MessageType === 'Detached') {
        const udid = known.get(event.data.DeviceID)
        known.delete(event.data.DeviceID)
        logger.info('device detached', { deviceId: event.data.DeviceID })
        onEvent(
          compact({
            kind: 'detached' as const,
            deviceId: event.data.DeviceID,
            udid
          })
        )
      }
    }
  }

  return {
    listDevices: async () => {
      const response = deviceListSchema.parse(await oneShot('ListDevices'))

      return preferUsb(
        response.DeviceList.map((entry) =>
          toUsbmuxDevice(entry.Properties, entry.DeviceID)
        )
      )
    },

    listen: async (onEvent, signal) => {
      const link = await open()
      const dispatch = eventDispatcher(onEvent)
      const stop = () => void link.close()
      signal.addEventListener('abort', stop, { once: true })
      try {
        expectOk(await request(link, 'Listen'), 'Listen')
        while (!signal.aborted)
          dispatch((await readUsbmuxPacket(link, limits)).message)
      } catch (error) {
        if (signal.aborted) return
        throw error
      } finally {
        signal.removeEventListener('abort', stop)
        await link.close()
      }
    },

    connect: async (deviceId, port) =>
      closeOnError(await open(), async (link) => {
        const response = await request(
          link,
          'Connect',
          createDict([
            ['DeviceID', deviceId],
            ['PortNumber', toNetworkPort(port)]
          ])
        )
        expectOk(response, `Connect to port ${port}`)
        logger.debug('usbmux connected', { deviceId, port })
        return link
      }),

    readBuid: async () =>
      buidResponseSchema.parse(await oneShot('ReadBUID')).BUID,

    readPairRecord: async (udid) => {
      const response = await oneShot(
        'ReadPairRecord',
        createDict([['PairRecordID', udid]])
      )
      const parsed = pairRecordResponseSchema.safeParse(response)

      return parsed.success ? parsed.data.PairRecordData : undefined
    }
  }
}
