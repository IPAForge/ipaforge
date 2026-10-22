// Live feeds the UI subscribes to: connected devices and new log entries. Each subscription has an id the client picks; the
// server streams `subscription-event`s for it until the client unsubscribes or the channel closes.
import { z } from 'zod'

export const subscriptionTopicSchema = z.enum(['devices', 'logs'])

const usbmuxDeviceSchema = z.object({
  udid: z.string().min(1),
  deviceId: z.number().int(),
  connectionType: z.enum(['usb', 'network']),
  productId: z.number().int().optional()
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
