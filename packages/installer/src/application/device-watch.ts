// Connected devices as a live feed, from usbmuxd's `Listen` instead of polling. One connection serves every
// listener. When it drops (the usbmuxd service restarted, the computer slept), it reconnects with backoff and sends
// one full list again; only when usbmuxd refuses `Listen` outright does it fall back to reading the list slowly.
// Beside it, a search of the local network finds known devices on Wi-Fi without usbmuxd (it keeps going when
// usbmuxd is missing), and says when the OS refuses local network access.

import type {
  DeviceWatch,
  DeviceWatchDeps,
  DeviceWatchEvent,
  DeviceWatchListener
} from '@installer/application/types.ts'
import type { DeviceEvent, UsbmuxDevice } from '@ipaforge/device'
import { ErrorCode, IPAForgeError, toIPAForgeError } from '@ipaforge/kernel'

const abortableSleep = (ms: number, signal: AbortSignal): Promise<void> =>
  new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(signal.reason)
      return
    }
    const timer = setTimeout(resolve, ms)
    signal.addEventListener(
      'abort',
      () => {
        clearTimeout(timer)
        reject(signal.reason)
      },
      { once: true }
    )
  })

/** How good a link is: USB, then straight over Wi-Fi (faster than usbmuxd's), then usbmuxd over Wi-Fi. */
const linkRank = (device: UsbmuxDevice): number => {
  if (device.connectionType === 'usb') return 0
  return device.address === undefined ? 2 : 1
}

/** One entry per device, with its best link. */
const byDevice = (attached: ReadonlyMap<number, UsbmuxDevice>) => {
  const devices = new Map<string, UsbmuxDevice>()
  for (const device of attached.values()) {
    const known = devices.get(device.udid)
    if (!known || linkRank(device) < linkRank(known))
      devices.set(device.udid, device)
  }
  return [...devices.values()]
}

const isLocalNetworkDenied = (error: unknown): boolean =>
  error instanceof IPAForgeError && error.code === ErrorCode.LocalNetworkDenied

/** usbmuxd answered `Listen` with an error before sending anything: it will not stream on this machine. */
const isListenRefused = (error: unknown, received: boolean): boolean =>
  !received &&
  error instanceof IPAForgeError &&
  error.code === ErrorCode.DeviceProtocolError

export const createDeviceWatch = ({
  devices,
  config,
  logger,
  sleep = abortableSleep
}: DeviceWatchDeps): DeviceWatch => {
  const log = logger.child({ scope: 'device-watch' })
  const listeners = new Set<DeviceWatchListener>()
  let attached = new Map<number, UsbmuxDevice>()
  let current: readonly UsbmuxDevice[] | undefined
  let controller: AbortController | undefined
  let networkDenied = false

  const emit = (event: DeviceWatchEvent) => {
    for (const listener of [...listeners]) listener(event)
  }

  const publish = () => {
    current = byDevice(attached)
    emit({ type: 'devices', devices: current })
  }

  const refresh = async () => {
    attached = new Map(
      (await devices.listDevices()).map((device) => [device.deviceId, device])
    )
    publish()
  }

  const apply = (event: DeviceEvent) => {
    if (event.kind === 'attached') {
      attached.set(event.device.deviceId, event.device)
      emit({ type: 'attached', device: event.device })
    } else {
      attached.delete(event.deviceId)
      emit({
        type: 'detached',
        deviceId: event.deviceId,
        ...(event.udid === undefined ? {} : { udid: event.udid })
      })
    }
    publish()
  }

  const poll = async (signal: AbortSignal) => {
    log.warn('usbmuxd refused Listen; reading the device list slowly', {
      intervalMs: config.devicePollIntervalMs
    })
    while (!signal.aborted) {
      await sleep(config.devicePollIntervalMs, signal)
      await refresh().catch((error: unknown) =>
        log.debug('device list failed', { code: toIPAForgeError(error).code })
      )
    }
  }

  const backoff = (failures: number) =>
    Math.min(
      config.deviceReconnectMaxMs,
      config.deviceReconnectBaseMs * 2 ** (failures - 1)
    )

  /** Listens until aborted; 'refused' when usbmuxd will not stream at all, and throws when the stream ends early. */
  const listen = async (
    signal: AbortSignal
  ): Promise<'refused' | 'stopped'> => {
    let received = false
    try {
      await devices.watch((event) => {
        received = true
        apply(event)
      }, signal)
    } catch (error) {
      if (isListenRefused(error, received)) return 'refused'
      throw error
    }
    if (signal.aborted) return 'stopped'
    throw new IPAForgeError(ErrorCode.DeviceDisconnected, {
      message: 'the usbmuxd event stream ended'
    })
  }

  const setNetworkDenied = (denied: boolean) => {
    if (denied === networkDenied) return
    networkDenied = denied
    emit({ type: 'network', denied })
  }

  /** Searches the network until aborted; retries with backoff, and ends when the host can't search at all. */
  const searchNetwork = async (signal: AbortSignal) => {
    let failures = 0
    while (!signal.aborted) {
      try {
        await devices.watchNetwork((event) => {
          setNetworkDenied(false)
          apply(event)
        }, signal)
        return
      } catch (error) {
        if (signal.aborted) return
        setNetworkDenied(isLocalNetworkDenied(error))
        failures += 1
        log.warn('network search failed; retrying', {
          code: toIPAForgeError(error).code,
          attempt: failures
        })
        await sleep(backoff(failures), signal)
      }
    }
  }

  const run = async (signal: AbortSignal) => {
    let failures = 0
    while (!signal.aborted) {
      try {
        // Also the one full refresh after a reconnect.
        await refresh()
        failures = 0
        if ((await listen(signal)) === 'refused') return poll(signal)
      } catch (error) {
        if (signal.aborted) return
        failures += 1
        const delayMs = backoff(failures)
        log.warn('device watch lost; reconnecting', {
          code: toIPAForgeError(error).code,
          attempt: failures,
          delayMs
        })
        await sleep(delayMs, signal)
      }
    }
  }

  const start = () => {
    const own = new AbortController()
    controller = own
    log.info('watching devices')
    run(own.signal).catch(() => {
      // Only an abort ends the loop with an error; it is how the watch stops.
    })
    searchNetwork(own.signal).catch(() => {
      // As above: only an abort.
    })
  }

  const stop = () => {
    controller?.abort()
    controller = undefined
    attached = new Map()
    current = undefined
    networkDenied = false
    log.info('stopped watching devices')
  }

  return {
    subscribe: (listener, signal) => {
      if (signal?.aborted) return () => {}
      listeners.add(listener)
      if (!controller) start()
      else if (current) {
        listener({ type: 'devices', devices: current })
        if (networkDenied) listener({ type: 'network', denied: true })
      }
      const unsubscribe = () => {
        signal?.removeEventListener('abort', unsubscribe)
        if (!listeners.delete(listener)) return
        if (listeners.size === 0) stop()
      }
      signal?.addEventListener('abort', unsubscribe, { once: true })
      return unsubscribe
    }
  }
}
