// Settings › Anisette servers, against the fake Engine: SideStore's list, the built-in backup, and servers added here.
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { t } from '@ui/__tests__/test-i18n.ts'
import { renderApp } from '@ui/__tests__/test-services.tsx'

// eslint-disable-next-line sonarjs/no-clear-text-protocols -- a server the user runs at home may be plain HTTP
const HOME = 'http://192.168.1.20:6969'

type User = ReturnType<typeof userEvent.setup>

/** Settings on its Anisette servers tab (the tab pressed, or opened by the `#anisette` link). */
const openCard = async (path = '/settings') => {
  const user = userEvent.setup()
  const rendered = await renderApp(path)
  if (path === '/settings')
    await user.click(
      await screen.findByRole('tab', {
        name: new RegExp(t('settings.tabs.anisette'))
      })
    )
  const card = await screen.findByRole('region', {
    name: t('settings.anisette.title')
  })
  await within(card).findByText('https://ani.sidestore.io')

  return { user, card, ...rendered }
}

const rowOf = (card: HTMLElement, address: string) => {
  const row = within(card).getByText(address).closest('li')
  if (!row) throw new Error(`no row for ${address}`)
  return row
}

const addServer = async (user: User, name: string, address: string) => {
  const [add] = screen.getAllByRole('button', {
    name: t('settings.anisette.add')
  })
  if (add) await user.click(add)
  const dialog = await screen.findByRole('dialog', {
    name: t('settings.anisette.dialog.addTitle')
  })
  await user.type(
    within(dialog).getByLabelText(t('settings.anisette.dialog.name')),
    name
  )
  await user.type(
    within(dialog).getByLabelText(t('settings.anisette.dialog.address')),
    address
  )
  await user.click(
    within(dialog).getByRole('button', { name: t('settings.anisette.add') })
  )

  return dialog
}

describe('Anisette servers', () => {
  it("lists SideStore's list in Automatic's order, then the backup, and says what was left out", async () => {
    const { card } = await openCard()

    expect(
      within(card).getByText(t('settings.anisette.group.list'))
    ).toBeDefined()
    expect(
      within(card).getByText(t('settings.anisette.group.backup'))
    ).toBeDefined()
    expect(
      within(rowOf(card, 'https://ani.sidestore.io')).getByText(
        t('settings.anisette.tag.inUse')
      )
    ).toBeDefined()
    expect(
      within(card).getByRole('img', {
        name: t('settings.anisette.position', { position: 1 })
      })
    ).toBeDefined()
    expect(card.textContent).toContain(
      t('settings.anisette.count', { count: 8 })
    )
    expect(card.textContent).toContain('Macley')
  })

  it('adds a plain-HTTP server of your own, first in the list', async () => {
    const { user, card } = await openCard()
    await addServer(user, 'Home', HOME)

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    const first = within(card).getAllByRole('listitem')[1]
    expect(first?.textContent).toContain('Home')
    expect(first?.textContent).toContain(t('settings.anisette.tag.custom'))
  })

  it('refuses a server already in the list, or one without a name', async () => {
    const { user } = await openCard()
    const dialog = await addServer(user, 'Again', 'https://ani.sidestore.io/')

    expect(
      await within(dialog).findByText(t('settings.anisette.dialog.exists'))
    ).toBeDefined()
    await user.clear(
      within(dialog).getByLabelText(t('settings.anisette.dialog.name'))
    )
    await user.click(
      within(dialog).getByRole('button', { name: t('settings.anisette.add') })
    )
    expect(
      await within(dialog).findByText(t('settings.anisette.dialog.nameMissing'))
    ).toBeDefined()
  })

  it('tests a server and says how fast it answered, or that it did not', async () => {
    const { user, card } = await openCard()
    await user.click(
      within(rowOf(card, 'https://ani.sidestore.io')).getByRole('button', {
        name: t('settings.anisette.testOne', { name: 'SideStore' })
      })
    )
    await waitFor(() =>
      expect(rowOf(card, 'https://ani.sidestore.io').textContent).toMatch(
        /Working · \d+ ms/
      )
    )

    await user.click(
      within(rowOf(card, 'https://ani.sidestore.zip')).getByRole('button', {
        name: t('settings.anisette.testOne', { name: 'SideStore (.zip)' })
      })
    )
    await waitFor(() =>
      expect(rowOf(card, 'https://ani.sidestore.zip').textContent).toContain(
        t('settings.anisette.status.bad')
      )
    )
  })

  it('picks one server, and warns when it does not answer', async () => {
    const { user, card } = await openCard()
    await user.click(
      within(card).getByRole('radio', {
        name: t('settings.anisette.mode.chosen')
      })
    )
    expect(
      await within(card).findByText(t('settings.anisette.noneChosen'))
    ).toBeDefined()

    await user.click(
      within(card).getByRole('radio', {
        name: t('settings.anisette.use', { name: 'SideStore (.zip)' })
      })
    )
    expect(
      await within(card).findByText(
        t('settings.anisette.modeHint.chosen', { name: 'SideStore (.zip)' })
      )
    ).toBeDefined()
    await user.click(
      within(rowOf(card, 'https://ani.sidestore.zip')).getByRole('button', {
        name: t('settings.anisette.testOne', { name: 'SideStore (.zip)' })
      })
    )
    expect(
      await within(card).findByText(
        t('settings.anisette.chosenDown', { name: 'SideStore (.zip)' })
      )
    ).toBeDefined()
  })

  it('removes a server you added, after asking', async () => {
    const { user, card } = await openCard()
    await addServer(user, 'Home', HOME)
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    await user.click(
      within(rowOf(card, HOME)).getByRole('button', {
        name: t('settings.anisette.remove', { name: 'Home' })
      })
    )
    await user.click(
      within(rowOf(card, HOME)).getByRole('button', {
        name: t('settings.anisette.removeYes')
      })
    )

    await waitFor(() => expect(within(card).queryByText(HOME)).toBeNull())
  })

  it('is outlined when opened from "Choose another anisette server"', async () => {
    const { card } = await openCard('/settings#anisette')

    await waitFor(() => expect(card.className).toContain('ring-accent'))
  })
})
