import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { t } from '@ui/__tests__/test-i18n.ts'
import {
  renderApp,
  type TestServicesOptions
} from '@ui/__tests__/test-services.tsx'
import { fakeAccounts } from '@ui/services/engine/fake/fake-data.ts'
import { createFakeEngineClient } from '@ui/services/engine/fake/fake-engine-client.ts'
import { selectionKeys } from '@ui/state/selection/constants.ts'

const WORK = 'work@example.com'
const STUDIO = 'studio@example.com'
const OLD = 'old@example.com'

const openPage = async (options: TestServicesOptions = {}) => {
  const user = userEvent.setup()
  const rendered = await renderApp('/accounts', options)
  const list = await screen.findByRole('list', { name: t('accounts.list') })

  return { user, list, ...rendered }
}

const rowFor = (list: HTMLElement, appleId: string) => {
  const row = within(list)
    .getAllByRole('listitem')
    .find((item) => item.textContent?.includes(appleId))
  if (!row) throw new Error(`no row for ${appleId}`)
  return row
}

const topBarAccount = (appleId: string) =>
  within(screen.getByRole('banner')).findByRole('button', {
    name: `${t('topBar.account')} ${appleId}`
  })

describe('Accounts page', () => {
  it('says when Apple IDs are kept only until the app quits, and nothing otherwise', async () => {
    await openPage({ scenario: 'no-keychain' })
    expect(await screen.findByText(t('accounts.notSaved.title'))).toBeDefined()
    expect(screen.getByText(t('accounts.notSaved.body'))).toBeDefined()
  })

  it('shows no keychain notice when Apple IDs are saved', async () => {
    const { list } = await openPage()
    await waitFor(() => expect(rowFor(list, WORK)).toBeDefined())
    expect(screen.queryByText(t('accounts.notSaved.title'))).toBeNull()
  })

  it('lists every saved Apple ID with its teams, marking the one in use', async () => {
    const { list } = await openPage()
    const work = rowFor(list, WORK)
    expect(within(work).getByText(t('accounts.inUse'))).toBeDefined()
    expect(
      within(work).queryByRole('button', { name: t('accounts.use') })
    ).toBeNull()
    await waitFor(() =>
      expect(rowFor(list, STUDIO).textContent).toContain('Example Studio')
    )
  })

  it('uses another Apple ID, keeping the choice and showing it in the top bar', async () => {
    const { user, list, services } = await openPage()
    await user.click(
      within(rowFor(list, STUDIO)).getByRole('button', {
        name: t('accounts.use')
      })
    )
    expect(await topBarAccount(STUDIO)).toBeDefined()
    expect(services.preferences.read(selectionKeys.account)).toBe(STUDIO)
    expect(
      within(rowFor(list, STUDIO)).getByText(t('accounts.inUse'))
    ).toBeDefined()
  })

  it('offers to sign in again where the session expired, with the Apple ID filled in', async () => {
    const { user, list } = await openPage({ scenario: 'accounts' })
    const old = rowFor(list, OLD)
    const again = await within(old).findByRole('button', {
      name: t('accounts.signInAgain')
    })
    expect(
      within(rowFor(list, WORK)).queryByRole('button', {
        name: t('accounts.signInAgain')
      })
    ).toBeNull()
    expect(rowFor(list, STUDIO).textContent).toContain(
      t('accounts.state.blocked')
    )

    await user.click(again)
    const dialog = await screen.findByRole('dialog', {
      name: t('signIn.title')
    })
    expect(
      (within(dialog).getByLabelText(/Apple ID/) as HTMLInputElement).value
    ).toBe(OLD)
  })

  it('asks before signing out, saying what is forgotten, and keeps the account on Cancel', async () => {
    const { user, list } = await openPage()
    await user.click(
      within(rowFor(list, STUDIO)).getByRole('button', {
        name: t('accounts.signOut.action')
      })
    )
    const confirm = await screen.findByRole('alertdialog', {
      name: t('accounts.signOut.title', { appleId: STUDIO })
    })
    expect(confirm.textContent).toContain(t('accounts.signOut.forgets'))
    expect(confirm.textContent).toContain(t('accounts.signOut.keeps'))

    await user.click(
      within(confirm).getByRole('button', { name: t('prompts.cancel') })
    )
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    expect(rowFor(list, STUDIO)).toBeDefined()
  })

  it('signs out the Apple ID in use and hands its place to the next saved one', async () => {
    const { user, list, services } = await openPage()
    await user.click(
      within(rowFor(list, WORK)).getByRole('button', {
        name: t('accounts.signOut.action')
      })
    )
    const confirm = await screen.findByRole('alertdialog')
    await user.click(
      within(confirm).getByRole('button', {
        name: t('accounts.signOut.confirm')
      })
    )

    await waitFor(() =>
      expect(
        within(screen.getByRole('list', { name: t('accounts.list') }))
          .getAllByRole('listitem')
          .map((row) => row.textContent?.includes(WORK))
      ).toEqual([false])
    )
    expect(await topBarAccount(STUDIO)).toBeDefined()
    expect(services.preferences.read(selectionKeys.account)).toBe(STUDIO)
  })

  it('says there are no Apple IDs yet and offers to add one', async () => {
    const user = userEvent.setup()
    await renderApp('/accounts', { scenario: 'no-accounts' })
    expect(await screen.findByText(t('accounts.empty'))).toBeDefined()
    await user.click(
      within(screen.getByRole('main')).getByRole('button', {
        name: t('topBar.addAppleId')
      })
    )
    expect(
      await screen.findByRole('dialog', { name: t('signIn.title') })
    ).toBeDefined()
  })

  it('reads the saved accounts once: no polling, no refetch on focus', async () => {
    const listAccounts = vi.fn(async () => fakeAccounts())
    await openPage({
      engine: createFakeEngineClient({
        delayMs: 0,
        overrides: { listAccounts }
      })
    })
    window.dispatchEvent(new Event('focus'))
    await new Promise((resolve) => setTimeout(resolve, 100))

    expect(listAccounts).toHaveBeenCalledTimes(1)
  })
})
