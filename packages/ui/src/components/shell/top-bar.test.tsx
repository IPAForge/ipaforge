import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { t } from '@ui/__tests__/test-i18n.ts'
import { renderApp } from '@ui/__tests__/test-services.tsx'
import { createFakeEngineClient } from '@ui/services/engine/fake/fake-engine-client.ts'

const findBanner = () => screen.findByRole('banner')
const findPicker = async (
  labelKey: 'topBar.device' | 'topBar.account',
  value: string
) =>
  within(await findBanner()).findByRole('button', {
    name: `${t(labelKey)} ${value}`
  })
const deviceValue = t('topBar.noDevice')

describe('TopBar', () => {
  it('shows the app name', async () => {
    await renderApp('/install')
    expect(within(await findBanner()).getByText(t('app.name'))).toBeDefined()
  })

  it('has menu buttons named by their label and value', async () => {
    await renderApp('/install')
    for (const button of [
      await findPicker('topBar.device', deviceValue),
      await findPicker('topBar.account', 'work@example.com')
    ]) {
      expect(button.getAttribute('aria-haspopup')).not.toBeNull()
      expect(button.getAttribute('aria-expanded')).not.toBe('true')
    }
  })

  it('opens the device menu with its disabled placeholder item', async () => {
    const user = userEvent.setup()
    await renderApp('/install')
    const button = await findPicker('topBar.device', deviceValue)

    await user.click(button)

    const item = within(await screen.findByRole('menu')).getByRole('menuitem', {
      name: t('topBar.devicesFound', { count: 0 })
    })
    expect(item.getAttribute('aria-disabled')).toBe('true')
    expect(button.getAttribute('aria-expanded')).toBe('true')
  })

  it('says "Not signed in" without a saved Apple ID', async () => {
    await renderApp('/install', {
      engine: createFakeEngineClient({
        delayMs: 0,
        overrides: { listAccounts: async () => [] }
      })
    })
    expect(
      await findPicker('topBar.account', t('topBar.notSignedIn'))
    ).toBeDefined()
  })

  it('opens the sign-in dialog from "Add Apple ID…"', async () => {
    const user = userEvent.setup()
    await renderApp('/install')
    await user.click(await findPicker('topBar.account', 'work@example.com'))

    const item = within(await screen.findByRole('menu')).getByRole('menuitem', {
      name: t('topBar.addAppleId')
    })
    expect(item.getAttribute('aria-disabled')).not.toBe('true')
    await user.click(item)
    expect(
      await screen.findByRole('dialog', { name: t('signIn.title') })
    ).toBeDefined()
  })

  it('opens a picker from the keyboard and closes it with Escape', async () => {
    const user = userEvent.setup()
    await renderApp('/install')
    ;(await findPicker('topBar.device', deviceValue)).focus()

    await user.keyboard('{Enter}')
    expect(await screen.findByRole('menu')).toBeDefined()

    await user.keyboard('{Escape}')
    expect(screen.queryByRole('menu')).toBeNull()
  })
})
