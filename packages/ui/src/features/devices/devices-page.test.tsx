// Manage → Devices against the fake Engine: a card per device, what to do for each state, and Use this device.
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { t } from '@ui/__tests__/test-i18n.ts'
import { renderApp } from '@ui/__tests__/test-services.tsx'
import {
  FAKE_IPAD,
  FAKE_IPHONE,
  fakeDevices,
  fakeIphoneCheck
} from '@ui/services/engine/fake/fake-data.ts'
import { createFakeDeviceFeed } from '@ui/services/engine/fake/fake-devices.ts'
import { createFakeEngineClient } from '@ui/services/engine/fake/fake-engine-client.ts'
import type { DeviceCheck } from '@ui/services/engine/types.ts'
import { selectionKeys } from '@ui/state/selection/constants.ts'

const card = async (name: string) => {
  const heading = await screen.findByRole('heading', { name })
  const element = heading.closest('[class*="card"]')
  if (!(element instanceof HTMLElement)) throw new Error(`no card for ${name}`)
  return element
}

describe('Devices page', () => {
  it('shows a card per device, the one in use marked', async () => {
    await renderApp('/devices', { scenario: 'devices' })
    const iphone = await card('iPhone')
    expect(within(iphone).getByText(t('devices.inUse'))).toBeDefined()
    await waitFor(() =>
      expect(iphone.textContent).toContain(t('devices.link.both'))
    )
    expect(await card('Studio iPad')).toBeDefined()
  })

  it('asks an untrusted device to trust this computer, then says what is left (Developer Mode)', async () => {
    const user = userEvent.setup()
    await renderApp('/devices', { scenario: 'devices' })
    await screen.findByText(t('devices.notice.notTrusted.titleUnnamed'))
    await user.click(
      screen.getByRole('button', {
        name: t('devices.notice.notTrusted.action')
      })
    )

    expect(
      await screen.findByText(
        t('devices.notice.developerModeOff.title', { name: 'Test iPhone SE' })
      )
    ).toBeDefined()
    expect(
      screen.getByText(t('devices.notice.developerModeOff.step1'))
    ).toBeDefined()
  })

  it('reads a locked device again on Check again, and shows it ready once unlocked', async () => {
    const user = userEvent.setup()
    let locked = true
    const deviceStatus = async (): Promise<DeviceCheck> => ({
      ...fakeIphoneCheck,
      locked
    })
    const engine = createFakeEngineClient({
      delayMs: 0,
      devices: createFakeDeviceFeed(
        false,
        fakeDevices.filter((device) => device.udid === FAKE_IPHONE)
      ),
      overrides: { deviceStatus }
    })
    await renderApp('/devices', { engine })
    const notice = await screen.findAllByText(
      t('devices.notice.locked.title', { name: 'iPhone' })
    )
    expect(notice.length).toBeGreaterThan(0)

    locked = false
    await user.click(
      screen.getAllByRole('button', {
        name: t('devices.checkAgain')
      })[0] as HTMLElement
    )
    await waitFor(() =>
      expect(
        screen.queryAllByText(
          t('devices.notice.locked.title', { name: 'iPhone' })
        )
      ).toHaveLength(0)
    )
  })

  it('makes another device the one in use, and keeps it', async () => {
    const user = userEvent.setup()
    const { services } = await renderApp('/devices', { scenario: 'devices' })
    const ipad = await card('Studio iPad')
    await user.click(
      within(ipad).getByRole('button', { name: t('devices.use') })
    )

    expect(services.preferences.read(selectionKeys.device)).toBe(FAKE_IPAD)
    await waitFor(() =>
      expect(within(ipad).getByText(t('devices.inUse'))).toBeDefined()
    )
  })

  it('says how to connect a device when there is none', async () => {
    await renderApp('/devices', { devices: createFakeDeviceFeed(false, []) })
    expect(await screen.findByText(t('devices.empty.title'))).toBeDefined()
  })
})

describe('Install page, about the device and the Apple ID in use', () => {
  it('offers another Apple ID when the one in use is blocked on the device in use', async () => {
    const user = userEvent.setup()
    const { services } = await renderApp('/install', {
      scenario: 'accounts',
      preferences: { [selectionKeys.account]: 'studio@example.com' }
    })
    await user.click(
      await screen.findByRole('button', {
        name: t('install.blocked.use', { appleId: 'work@example.com' })
      })
    )

    expect(services.preferences.read(selectionKeys.account)).toBe(
      'work@example.com'
    )
  })
})
