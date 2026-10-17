// The device picker in the top bar, against the fake Engine: what it lists, what picking keeps, and how a device
// that comes and goes is shown.
import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { t } from '@ui/__tests__/test-i18n.ts'
import { renderApp } from '@ui/__tests__/test-services.tsx'
import {
  FAKE_IPAD,
  FAKE_IPHONE,
  fakeDevices
} from '@ui/services/engine/fake/fake-data.ts'
import { createFakeDeviceFeed } from '@ui/services/engine/fake/fake-devices.ts'
import { createFakeEngine } from '@ui/services/engine/fake/fake-engine.ts'
import { createFakeEngineClient } from '@ui/services/engine/fake/fake-engine-client.ts'
import { selectionKeys } from '@ui/state/selection/selection-store.ts'

const IPHONE = fakeDevices.find((device) => device.udid === FAKE_IPHONE)
if (!IPHONE) throw new Error('the fake data has an iPhone')

const deviceButton = async () =>
  within(await screen.findByRole('banner')).findByRole('button', {
    name: new RegExp(`^${t('topBar.device')} `)
  })

const openMenu = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(await deviceButton())
  return screen.findByRole('menu')
}

const items = (menu: HTMLElement) => within(menu).getAllByRole('menuitemradio')

describe('DevicePicker', () => {
  it('lists every device with its model, iOS, connection and state, the one in use checked', async () => {
    const user = userEvent.setup()
    await renderApp('/install')
    const menu = await openMenu(user)

    await waitFor(() =>
      expect(items(menu)[0]?.textContent).toContain('iOS 26.1')
    )
    const [iphone, ipad] = items(menu)
    expect(iphone?.textContent).toContain(t('devices.link.usb'))
    expect(iphone?.getAttribute('aria-checked')).toBe('true')
    await waitFor(() =>
      expect(ipad?.textContent).toContain(t('devices.state.notTrusted'))
    )
    expect(
      within(menu).getByRole('menuitem', { name: t('topBar.openDevices') })
    ).toBeDefined()
  })

  it('lists a device on USB and Wi-Fi once, as both', async () => {
    const user = userEvent.setup()
    await renderApp('/install', { scenario: 'devices' })
    const menu = await openMenu(user)

    await waitFor(() =>
      expect(items(menu)[0]?.textContent).toContain(t('devices.link.both'))
    )
    expect(items(menu)).toHaveLength(3)
  })

  it('keeps the picked device, and says its state in the top bar', async () => {
    const user = userEvent.setup()
    const { services } = await renderApp('/install')
    const menu = await openMenu(user)
    await user.click(items(menu)[1] as HTMLElement)

    expect(services.preferences.read(selectionKeys.device)).toBe(FAKE_IPAD)
    await waitFor(async () =>
      expect((await deviceButton()).textContent).toContain(
        t('devices.state.notTrusted')
      )
    )
  })

  it('reads every status again when the menu opens, and never on a timer', async () => {
    const user = userEvent.setup()
    const fake = createFakeEngine({ delayMs: 0 })
    const deviceStatus = vi.fn(fake.deviceStatus)
    const engine = createFakeEngineClient({
      delayMs: 0,
      overrides: { deviceStatus }
    })
    await renderApp('/install', { engine })
    await waitFor(() => expect(deviceStatus).toHaveBeenCalled())
    await new Promise((resolve) => setTimeout(resolve, 200))
    const before = deviceStatus.mock.calls.length

    await openMenu(user)
    await waitFor(() =>
      expect(deviceStatus.mock.calls.length).toBeGreaterThan(before)
    )
  })

  it('keeps a picked device that is unplugged as not connected, and uses it again when it is back', async () => {
    const devices = createFakeDeviceFeed(false)
    await renderApp('/install', {
      devices,
      preferences: { [selectionKeys.device]: FAKE_IPHONE }
    })
    await waitFor(async () =>
      expect((await deviceButton()).textContent).toContain('iPhone')
    )

    act(() => devices.unplug(FAKE_IPHONE))
    await waitFor(async () =>
      expect((await deviceButton()).textContent).toContain(
        t('devices.state.notConnected')
      )
    )
    expect(
      await screen.findByText(
        t('devices.notice.notConnected.title', { name: 'iPhone' })
      )
    ).toBeDefined()

    act(() => devices.plugIn(IPHONE))
    await waitFor(async () =>
      expect((await deviceButton()).textContent).not.toContain(
        t('devices.state.notConnected')
      )
    )
  })

  it('notes a device coming and going quietly, without an error screen', async () => {
    const devices = createFakeDeviceFeed(false)
    await renderApp('/install', { devices })
    await deviceButton()
    await waitFor(() =>
      expect(screen.queryByText(t('devices.state.checking'))).toBeNull()
    )

    act(() => devices.unplug(FAKE_IPHONE))
    expect(
      await screen.findByText(
        t('devices.notes.disconnected', { name: 'iPhone' })
      )
    ).toBeDefined()
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('says there are no devices yet, and the Install page says how to connect one', async () => {
    const user = userEvent.setup()
    await renderApp('/install', { devices: createFakeDeviceFeed(false, []) })
    expect(
      await screen.findByText(t('devices.notice.none.title'))
    ).toBeDefined()

    const menu = await openMenu(user)
    const empty = within(menu).getByRole('menuitem', {
      name: new RegExp(t('devices.empty.title'))
    })
    expect(empty.getAttribute('aria-disabled')).toBe('true')
  })

  it('counts an Apple ID as blocked only on the device in use', async () => {
    const user = userEvent.setup()
    await renderApp('/install', {
      scenario: 'accounts',
      preferences: { [selectionKeys.account]: 'studio@example.com' }
    })
    const account = () =>
      within(screen.getByRole('banner')).getByRole('button', {
        name: new RegExp(`^${t('topBar.account')} `)
      })
    await waitFor(() =>
      expect(account().textContent).toContain(t('accounts.state.blocked'))
    )

    const menu = await openMenu(user)
    await user.click(items(menu)[1] as HTMLElement)
    await waitFor(() =>
      expect(account().textContent).not.toContain(t('accounts.state.blocked'))
    )
  })
})
