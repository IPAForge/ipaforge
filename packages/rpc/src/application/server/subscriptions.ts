// The live feeds the UI subscribed to, by the id it chose: each forwards the Engine's events over the channel
// until the UI unsubscribes or the channel closes.
import type { Engine } from '@ipaforge/installer'
import { subscriptionIdInUse } from '@rpc/domain/errors.ts'
import type { LogSource } from '@rpc/domain/ports/log-source.ts'
import type {
  SubscriptionTopic,
  WireDeviceWatchEvent,
  WireLogEntry,
  WirePairableWatchEvent,
  WireSubscriptionEvent
} from '@rpc/domain/protocol/types.ts'
import { toWire } from '@rpc/domain/wire.ts'

export type SubscriptionRegistry = {
  subscribe(subscriptionId: string, topic: SubscriptionTopic): void
  /** Ending a subscription that already ended is not an error. */
  unsubscribe(subscriptionId: string): void
  /** Ends every subscription (the channel closed). */
  closeAll(): void
}

const nothingToStop = (): void => {}

export const createSubscriptionRegistry = (
  engine: Engine,
  logs: LogSource | undefined,
  /** Sends one event; for logs it must not log a failure, or the failure would be the next entry to send. */
  sendEvent: (
    subscriptionId: string,
    event: WireSubscriptionEvent,
    options: { readonly quiet: boolean }
  ) => void
): SubscriptionRegistry => {
  const active = new Map<string, () => void>()

  const topics: Record<SubscriptionTopic, (id: string) => () => void> = {
    devices: (subscriptionId) =>
      engine.watchDevices((event) =>
        // The Engine's event is plain data; zod's inferred arrays are just not readonly.
        sendEvent(subscriptionId, toWire(event) as WireDeviceWatchEvent, {
          quiet: false
        })
      ),
    pairable: (subscriptionId) =>
      engine.watchPairableDevices((event) =>
        sendEvent(
          subscriptionId,
          {
            type: 'pairable',
            event: toWire(event) as WirePairableWatchEvent['event']
          },
          { quiet: false }
        )
      ),
    logs: (subscriptionId) =>
      logs?.buffer.subscribe((entry) =>
        sendEvent(
          subscriptionId,
          { type: 'log', entry: toWire(entry) as WireLogEntry },
          { quiet: true }
        )
      ) ?? nothingToStop
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
