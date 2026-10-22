import { describe, expect, it, vi } from 'vitest'

import { createDeviceWatch } from '@installer/application/device-watch.ts'
import type { DeviceWatchEvent } from '@installer/application/types.ts'
import type { DeviceEvent, DeviceManager, UsbmuxDevice } from '@ipaforge/device'
import { ErrorCode, IPAForgeError, silentLogger } from '@ipaforge/kernel'

const usb = (udid: string, deviceId: number): UsbmuxDevice => ({
  udid,
  deviceId,
  connectionType: 'usb'
})
const IPHONE = usb('IPHONE', 1)
const IPAD = usb('IPAD', 2)

type Session = {
  readonly emit: (event: DeviceEvent) => void
  readonly drop: (error: unknown) => void
  readonly signal: AbortSignal
}

/** A session the test drives: it stays open until aborted or dropped. */
const sessionsOf = (sessions: Session[]) =>
  vi.fn(
    (onEvent: (event: DeviceEvent) => void, signal: AbortSignal) =>
      new Promise<void>((resolve, reject) => {
        sessions.push({ emit: onEvent, drop: reject, signal })
        signal.addEventListener('abort', () => resolve(), { once: true })
      })
  )

/**
 * A DeviceManager whose `Listen` sessions and network searches the test drives: each `watch` and `watchNetwork`
 * call is a session that stays open.
 */
const fakeUsbmux = (listed: () => UsbmuxDevice[]) => {
  const sessions: Session[] = []
  const searches: Session[] = []
  const listDevices = vi.fn(async () => listed())
  const watch = sessionsOf(sessions)
  const watchNetwork = sessionsOf(searches)
  const devices = {
    listDevices,
    watch,
    watchNetwork
  } as unknown as DeviceManager

  return { devices, listDevices, watch, sessions, searches }
}

const config = {
  deviceReconnectBaseMs: 1000,
  deviceReconnectMaxMs: 30_000,
  devicePollIntervalMs: 30_000
}

const setup = (listed: () => UsbmuxDevice[] = () => [IPHONE]) => {
  const usbmux = fakeUsbmux(listed)
  const sleeps: number[] = []
  const sleep = vi.fn(async (ms: number, signal: AbortSignal) => {
    sleeps.push(ms)
    // Lets the test run the loop step by step; a stop ends the wait.
    await new Promise((resolve) => setTimeout(resolve, 0))
    signal.throwIfAborted()
  })
  const watch = createDeviceWatch({
    devices: usbmux.devices,
    config,
    logger: silentLogger,
    sleep
  })

  return { ...usbmux, watch, sleeps, sleep }
}

const record = () => {
  const events: DeviceWatchEvent[] = []

  return { events, listener: (event: DeviceWatchEvent) => events.push(event) }
}

const lists = (events: DeviceWatchEvent[]) =>
  events.flatMap((event) =>
    event.type === 'devices' ? [event.devices.map((d) => d.udid)] : []
  )

describe('createDeviceWatch', () => {
  it('sends the list, then each attach and detach with the list after it', async () => {
    const { watch, sessions, listDevices } = setup()
    const { events, listener } = record()
    watch.subscribe(listener)
    await vi.waitFor(() => expect(sessions).toHaveLength(1))

    sessions[0]?.emit({ kind: 'attached', device: IPAD })
    sessions[0]?.emit({ kind: 'detached', deviceId: 1, udid: 'IPHONE' })

    expect(events.map((event) => event.type)).toEqual([
      'devices',
      'attached',
      'devices',
      'detached',
      'devices'
    ])
    expect(lists(events)).toEqual([['IPHONE'], ['IPHONE', 'IPAD'], ['IPAD']])
    expect(listDevices).toHaveBeenCalledTimes(1)
  })

  it('lists a device on USB and Wi-Fi once', async () => {
    const { watch, sessions } = setup(() => [
      { udid: 'IPHONE', deviceId: 5, connectionType: 'network' },
      IPHONE
    ])
    const { events, listener } = record()
    watch.subscribe(listener)
    await vi.waitFor(() => expect(sessions).toHaveLength(1))
    expect(events[0]).toEqual({ type: 'devices', devices: [IPHONE] })
  })

  it('serves every listener from one usbmuxd connection, and gives a late one the current list', async () => {
    const { watch, sessions } = setup()
    const first = record()
    const second = record()
    watch.subscribe(first.listener)
    await vi.waitFor(() => expect(sessions).toHaveLength(1))
    watch.subscribe(second.listener)

    expect(second.events).toEqual([{ type: 'devices', devices: [IPHONE] }])
    sessions[0]?.emit({ kind: 'attached', device: IPAD })
    expect(lists(second.events).at(-1)).toEqual(['IPHONE', 'IPAD'])
    expect(sessions).toHaveLength(1)
  })

  it('reconnects with backoff when the connection drops, and sends one full list after', async () => {
    let listed = [IPHONE]
    const { watch, sessions, listDevices, sleeps } = setup(() => listed)
    const { events, listener } = record()
    watch.subscribe(listener)
    await vi.waitFor(() => expect(sessions).toHaveLength(1))

    listed = [IPHONE, IPAD]
    sessions[0]?.drop(new IPAForgeError(ErrorCode.DeviceDisconnected))
    await vi.waitFor(() => expect(sessions).toHaveLength(2))

    expect(sleeps).toEqual([1000])
    expect(listDevices).toHaveBeenCalledTimes(2)
    expect(lists(events)).toEqual([['IPHONE'], ['IPHONE', 'IPAD']])
  })

  it('backs off longer while usbmuxd stays away, then starts over once it is back', async () => {
    let available = false
    const { watch, sessions, sleeps } = setup(() => {
      if (!available) throw new IPAForgeError(ErrorCode.UsbmuxdUnavailable)
      return [IPHONE]
    })
    watch.subscribe(() => {})
    await vi.waitFor(() => expect(sleeps.length).toBeGreaterThanOrEqual(3))
    available = true
    await vi.waitFor(() => expect(sessions).toHaveLength(1))

    expect(sleeps.slice(0, 3)).toEqual([1000, 2000, 4000])
  })

  it('falls back to reading the list slowly when usbmuxd refuses Listen', async () => {
    const { watch, sessions, listDevices, sleeps } = setup()
    const unsubscribe = watch.subscribe(() => {})
    await vi.waitFor(() => expect(sessions).toHaveLength(1))
    sessions[0]?.drop(
      new IPAForgeError(ErrorCode.DeviceProtocolError, {
        message: 'usbmuxd Listen failed'
      })
    )
    await vi.waitFor(() =>
      expect(listDevices.mock.calls.length).toBeGreaterThanOrEqual(3)
    )
    unsubscribe()

    expect(new Set(sleeps)).toEqual(new Set([30_000]))
    expect(sessions).toHaveLength(1)
  })

  it('stops listening when the last listener leaves or its signal aborts', async () => {
    const { watch, sessions } = setup()
    const controller = new AbortController()
    const unsubscribe = watch.subscribe(() => {})
    watch.subscribe(() => {}, controller.signal)
    await vi.waitFor(() => expect(sessions).toHaveLength(1))

    unsubscribe()
    expect(sessions[0]?.signal.aborted).toBe(false)
    controller.abort()
    expect(sessions[0]?.signal.aborted).toBe(true)

    // A new listener starts a fresh connection.
    watch.subscribe(() => {})
    await vi.waitFor(() => expect(sessions).toHaveLength(2))
  })

  it('adds devices found on Wi-Fi, each with its best link: USB, then straight over Wi-Fi, then usbmuxd', async () => {
    const usbmuxWifi: UsbmuxDevice = {
      udid: 'IPAD',
      deviceId: 2,
      connectionType: 'network'
    }
    const { watch, sessions, searches } = setup(() => [IPHONE, usbmuxWifi])
    const { events, listener } = record()
    watch.subscribe(listener)
    await vi.waitFor(() => expect(sessions).toHaveLength(1))
    await vi.waitFor(() => expect(searches).toHaveLength(1))
    const [search] = searches
    const direct = (udid: string, deviceId: number): UsbmuxDevice => ({
      udid,
      deviceId,
      connectionType: 'network',
      address: '192.0.2.10'
    })
    search?.emit({ kind: 'attached', device: direct('IPHONE', -1) })
    search?.emit({ kind: 'attached', device: direct('IPAD', -2) })
    search?.emit({ kind: 'attached', device: direct('IPOD', -3) })

    const last = events.filter((event) => event.type === 'devices').at(-1)
    expect(last).toEqual({
      type: 'devices',
      devices: [IPHONE, direct('IPAD', -2), direct('IPOD', -3)]
    })
  })

  it('says when the OS refuses local network access, also to a listener that comes later', async () => {
    const { watch, searches } = setup()
    const first = record()
    watch.subscribe(first.listener)
    await vi.waitFor(() => expect(searches).toHaveLength(1))
    searches[0]?.drop(new IPAForgeError(ErrorCode.LocalNetworkDenied))
    await vi.waitFor(() =>
      expect(first.events).toContainEqual({ type: 'network', denied: true })
    )

    const late = record()
    watch.subscribe(late.listener)
    expect(late.events).toContainEqual({ type: 'network', denied: true })
  })
})
