// Live feeds the UI subscribes to (today: connected devices). Each subscription has an id the client picks; the
// server streams `subscription-event`s for it until the client unsubscribes or the channel closes.
import { z } from 'zod'

export const subscriptionTopicSchema = z.enum(['devices'])

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
  })
])

export type SubscriptionTopic = z.infer<typeof subscriptionTopicSchema>
export type WireDeviceWatchEvent = z.infer<typeof deviceWatchEventSchema>
