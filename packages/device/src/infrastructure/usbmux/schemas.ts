// usbmuxd responses, validated at the boundary.

import { z } from 'zod'

import type { UsbmuxDevice } from '@device/domain/types.ts'
import { compact } from '@ipaforge/kernel'

const integer = z.union([z.number().int(), z.bigint().transform(Number)])

export const propertiesSchema = z.looseObject({
  ConnectionType: z.string(),
  DeviceID: integer.optional(),
  SerialNumber: z.string().min(1),
  ProductID: integer.optional()
})

export type UsbmuxProperties = z.infer<typeof propertiesSchema>

export const deviceListSchema = z.looseObject({
  DeviceList: z.array(
    z.looseObject({ DeviceID: integer, Properties: propertiesSchema })
  )
})

export const eventSchema = z.discriminatedUnion('MessageType', [
  z.looseObject({
    MessageType: z.literal('Attached'),
    DeviceID: integer,
    Properties: propertiesSchema
  }),
  z.looseObject({ MessageType: z.literal('Detached'), DeviceID: integer }),
  z.looseObject({ MessageType: z.literal('Paired'), DeviceID: integer })
])

export const resultSchema = z.looseObject({
  MessageType: z.literal('Result'),
  Number: integer
})

export const buidResponseSchema = z.looseObject({ BUID: z.string().min(1) })

export const pairRecordResponseSchema = z.looseObject({
  PairRecordData: z.instanceof(Uint8Array)
})

/** usbmuxd's `SerialNumber` is the UDID; it reports USB as "USB" and Wi-Fi as "Network". */
export const toUsbmuxDevice = (
  properties: UsbmuxProperties,
  deviceId: number
): UsbmuxDevice =>
  compact({
    udid: properties.SerialNumber,
    deviceId,
    connectionType:
      properties.ConnectionType === 'Network'
        ? ('network' as const)
        : ('usb' as const),
    productId: properties.ProductID
  })
