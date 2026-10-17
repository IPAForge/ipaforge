// The live feeds the UI subscribed to, by the id it chose: each forwards the Engine's events over the channel
// until the UI unsubscribes or the channel closes.
import type { Engine } from '@loadstar/installer'
import { subscriptionIdInUse } from '@rpc/domain/errors.ts'
import type {
  MessageBody,
  SubscriptionTopic,
  WireDeviceWatchEvent
} from '@rpc/domain/protocol/types.ts'
import { toWire } from '@rpc/domain/wire.ts'

export type SubscriptionRegistry = {
  subscribe(subscriptionId: string, topic: SubscriptionTopic): void
  /** Ending a subscription that already ended is not an error. */
  unsubscribe(subscriptionId: string): void
  /** Ends every subscription (the channel closed). */
  closeAll(): void
}

export const createSubscriptionRegistry = (
  engine: Engine,
  send: (message: MessageBody) => void
): SubscriptionRegistry => {
  const active = new Map<string, () => void>()

  const topics: Record<SubscriptionTopic, (id: string) => () => void> = {
    devices: (subscriptionId) =>
      engine.watchDevices((event) =>
        send({
          type: 'subscription-event',
          subscriptionId,
          // The Engine's event is plain data; zod's inferred arrays are just not readonly.
          event: toWire(event) as WireDeviceWatchEvent
        })
      )
  }

  return {
    subscribe: (subscriptionId, topic) => {
      if (active.has(subscriptionId)) throw subscriptionIdInUse(subscriptionId)
      active.set(subscriptionId, topics[topic](subscriptionId))
    },
    unsubscribe: (subscriptionId) => {
      active.get(subscriptionId)?.()
      active.delete(subscriptionId)
    },
    closeAll: () => {
      for (const stop of active.values()) stop()
      active.clear()
    }
  }
}
