import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { t } from '@ui/__tests__/test-i18n.ts'
import {
  renderApp,
  type TestServicesOptions
} from '@ui/__tests__/test-services.tsx'
import { selectionKeys } from '@ui/state/selection/selection-store.ts'

const WORK = 'work@example.com'
const STUDIO = 'studio@example.com'
const OLD = 'old@example.com'

const findBanner = () => screen.findByRole('banner')
const findPicker = async (
  labelKey: 'topBar.device' | 'topBar.account',
  value: string
) =>
  within(await findBanner()).findByRole('button', {
    name: `${t(labelKey)} ${value}`
  })

const openAccounts = async (
  value = WORK,
  options: TestServicesOptions = {}
) => {
  const user = userEvent.setup()
  const rendered = await renderApp('/install', options)
  await user.click(await findPicker('topBar.account', value))
  const menu = await screen.findByRole('menu')

  return { user, menu, ...rendered }
}

const itemFor = (menu: HTMLElement, appleId: string) =>
  within(menu)
    .getAllByRole('menuitemradio')
    .find((item) => item.textContent?.includes(appleId))

describe('TopBar', () => {
  it('shows the app name and the Device placeholder', async () => {
    await renderApp('/install')
    expect(within(await findBanner()).getByText(t('app.name'))).toBeDefined()
    expect(
      await findPicker('topBar.device', t('topBar.noDevice'))
    ).toBeDefined()
  })

  it('lists the saved Apple IDs with their teams, the one in use checked', async () => {
    const { menu } = await openAccounts()
    const items = within(menu).getAllByRole('menuitemradio')
    expect(items).toHaveLength(2)
    expect(itemFor(menu, WORK)?.getAttribute('aria-checked')).toBe('true')
    await waitFor(() =>
      expect(itemFor(menu, STUDIO)?.textContent).toContain(
        `${t('accounts.freeTeam', { name: 'Personal team' })} and Example Studio`
      )
    )
    expect(
      within(menu).getByRole('menuitem', { name: t('topBar.addAppleId') })
    ).toBeDefined()
  })

  it('says which Apple ID needs signing in again and which is blocked on this device', async () => {
    const { menu } = await openAccounts(WORK, { scenario: 'accounts' })
    await waitFor(() =>
      expect(itemFor(menu, OLD)?.textContent).toContain(
        t('accounts.state.signInNeeded')
      )
    )
    expect(itemFor(menu, STUDIO)?.textContent).toContain(
      t('accounts.state.blocked')
    )
    expect(itemFor(menu, WORK)?.textContent).not.toContain(' · ')
  })

  it('makes the chosen Apple ID the one in use, and keeps it', async () => {
    const { user, menu, services } = await openAccounts()
    await user.click(itemFor(menu, STUDIO) as HTMLElement)

    expect(await findPicker('topBar.account', STUDIO)).toBeDefined()
    expect(services.preferences.read(selectionKeys.account)).toBe(STUDIO)
  })

  it('starts with the saved choice', async () => {
    await renderApp('/install', {
      preferences: { [selectionKeys.account]: STUDIO }
    })
    expect(await findPicker('topBar.account', STUDIO)).toBeDefined()
  })

  it('says there are no Apple IDs yet, and still offers to add one', async () => {
    const { menu } = await openAccounts(t('topBar.notSignedIn'), {
      scenario: 'no-accounts'
    })
    const empty = within(menu).getByRole('menuitem', {
      name: t('topBar.noAccounts')
    })
    expect(empty.getAttribute('aria-disabled')).toBe('true')
    expect(
      within(menu).getByRole('menuitem', { name: t('topBar.addAppleId') })
    ).toBeDefined()
  })

  it('opens the sign-in dialog from "Add Apple ID…"', async () => {
    const { user, menu } = await openAccounts()
    await user.click(
      within(menu).getByRole('menuitem', { name: t('topBar.addAppleId') })
    )
    expect(
      await screen.findByRole('dialog', { name: t('signIn.title') })
    ).toBeDefined()
  })

  it('is used from the keyboard: Enter opens, Enter on an item picks it, Escape closes', async () => {
    const user = userEvent.setup()
    const { services } = await renderApp('/install')
    ;(await findPicker('topBar.account', WORK)).focus()

    await user.keyboard('{Enter}')
    const menu = await screen.findByRole('menu')
    // happy-dom does not move focus into the popover on its own; a focused item still takes Enter.
    ;(itemFor(menu, STUDIO) as HTMLElement).focus()
    await user.keyboard('{Enter}')
    await waitFor(() =>
      expect(services.preferences.read(selectionKeys.account)).toBe(STUDIO)
    )

    ;(await findPicker('topBar.account', STUDIO)).focus()
    await user.keyboard('{Enter}')
    expect(await screen.findByRole('menu')).toBeDefined()
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('menu')).toBeNull()
  })
})
