import { focusManager, onlineManager } from '@tanstack/react-query'
import { act, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { renderAppHook } from '@ui/__tests__/hook-wrapper.tsx'
import { t } from '@ui/__tests__/test-i18n.ts'
import { renderApp } from '@ui/__tests__/test-services.tsx'
import { QUERY_STALE_TIME_MS } from '@ui/hooks/queries/query-client.ts'
import { queryKeys } from '@ui/hooks/queries/query-keys.ts'
import { useAccounts } from '@ui/hooks/queries/use-accounts.ts'
import { useDeviceFeed } from '@ui/hooks/queries/use-device-feed.ts'
import { useDevices } from '@ui/hooks/queries/use-devices.ts'
import { FAKE_IPAD, fakeDevices } from '@ui/services/engine/fake/fake-data.ts'
import { createFakeDeviceFeed } from '@ui/services/engine/fake/fake-devices.ts'
import { createFakeEngineClient } from '@ui/services/engine/fake/fake-engine-client.ts'

const IPAD = fakeDevices.find((device) => device.udid === FAKE_IPAD)
if (!IPAD) throw new Error('the fake data has an iPad')

/** A fake Engine whose device list the test controls and counts. */
const countingEngine = () => {
  const devices = createFakeDeviceFeed(false)
  const listDevices = vi.fn(async () => devices.list())
  const listAccounts = vi.fn(async () => [])
  const engine = createFakeEngineClient({
    delayMs: 0,
    devices,
    overrides: { listDevices, listAccounts }
  })

  return { engine, devices, listDevices, listAccounts }
}

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

afterEach(() => {
  focusManager.setFocused(undefined)
  onlineManager.setOnline(true)
})

describe('the device feed', () => {
  it('updates the device list on attach and detach, without reading the list again', async () => {
    const { engine, devices, listDevices } = countingEngine()
    const { result, queryClient } = renderAppHook(
      () => {
        useDeviceFeed()
        return useDevices()
      },
      { engine }
    )
    await waitFor(() => expect(result.current.data).toHaveLength(2))

    act(() => devices.unplug(FAKE_IPAD))
    await waitFor(() =>
      expect(result.current.data?.map((d) => d.udid)).not.toContain(FAKE_IPAD)
    )
    act(() => devices.plugIn(IPAD))
    await waitFor(() => expect(result.current.data).toHaveLength(2))

    await pause(100)
    expect(listDevices).toHaveBeenCalledTimes(1)
    const query = queryClient.getQueryCache().find({
      queryKey: queryKeys.devices
    })
    expect(query?.options).not.toHaveProperty('refetchInterval')
  })

  it('stops listening when the app goes away', async () => {
    const devices = createFakeDeviceFeed(false)
    const watch = devices.watch
    const unsubscribed = vi.fn()
    devices.watch = (listener, signal) => {
      const stop = watch(listener, signal)

      return () => {
        unsubscribed()
        stop()
      }
    }
    const { unmount } = renderAppHook(useDeviceFeed, {
      engine: createFakeEngineClient({ delayMs: 0, devices })
    })
    await pause(20)
    expect(unsubscribed).not.toHaveBeenCalled()

    unmount()
    await waitFor(() => expect(unsubscribed).toHaveBeenCalledTimes(1))
  })

  it('shows the change on the Devices page at once', async () => {
    const devices = createFakeDeviceFeed(false)
    await renderApp('/devices', { devices })
    expect(
      await screen.findByText(t('devices.engine.connected', { count: 2 }))
    ).toBeDefined()

    act(() => devices.unplug(FAKE_IPAD))
    expect(
      await screen.findByText(t('devices.engine.connected', { count: 1 }))
    ).toBeDefined()
  })
})

describe('query defaults', () => {
  it('keep data fresh for a while and never refetch on focus or reconnect', async () => {
    const { engine, listAccounts } = countingEngine()
    const { result, queryClient } = renderAppHook(useAccounts, { engine })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    act(() => {
      focusManager.setFocused(false)
      focusManager.setFocused(true)
      onlineManager.setOnline(false)
      onlineManager.setOnline(true)
    })
    await pause(50)

    expect(listAccounts).toHaveBeenCalledTimes(1)
    const defaults = queryClient.getDefaultOptions().queries
    expect(defaults).toMatchObject({
      retry: false,
      staleTime: QUERY_STALE_TIME_MS,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false
    })
  })
})
