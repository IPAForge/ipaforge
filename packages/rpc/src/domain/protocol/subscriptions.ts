// Live feeds the UI subscribes to: connected devices, Apple TVs and Vision Pros showing their pairing screen, and new
// log entries. Each subscription has an id the client picks; the server streams `subscription-event`s for it until
// the client unsubscribes or the channel closes.
import { z } from 'zod'

import { pairableDeviceSchema } from '@rpc/domain/protocol/inputs.ts'

export const subscriptionTopicSchema = z.enum(['devices', 'pairable', 'logs'])

const usbmuxDeviceSchema = z.object({
  udid: z.string().min(1),
  deviceId: z.number().int(),
  connectionType: z.enum(['usb', 'network']),
  productId: z.number().int().optional(),
  address: z.string().optional(),
  pairedByCode: z.literal(true).optional()
})

export const deviceWatchEventSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('devices'),
    devices: z.array(usbmuxDeviceSchema)
  }),
  z.object({ type: z.literal('attached'), device: usbmuxDeviceSchema }),
  z.object({
    type: z.literal('detached'),
    deviceId: z.number().int(),
    udid: z.string().optional()
  }),
  z.object({ type: z.literal('network'), denied: z.boolean() })
])

export const pairableWatchEventSchema = z.object({
  type: z.literal('pairable'),
  event: z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('found'), device: pairableDeviceSchema }),
    z.object({ kind: z.literal('lost'), id: z.string().min(1) }),
    z.object({ kind: z.literal('denied') }),
    z.object({ kind: z.literal('failed'), code: z.string().min(1) })
  ])
})
