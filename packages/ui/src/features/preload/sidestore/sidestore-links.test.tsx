// SideStore's links from IPAForge: a source you added goes to SideStore by a QR code (one at a time with Add all),
// and an app from a source can be installed by SideStore itself, the version picked; built-in sources have none.
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { t } from '@ui/__tests__/test-i18n.ts'
import { renderApp } from '@ui/__tests__/test-services.tsx'

type User = ReturnType<typeof userEvent.setup>

const sourceRow = (name: string) =>
  waitFor(() => {
    const item = within(
      screen.getByRole('list', { name: t('preload.sources.list') })
    )
      .getAllByRole('listitem')
      .find((candidate) => candidate.textContent?.includes(name))

    if (!item) throw new Error(`no source ${name}`)

    return item
  })

/** Adds the source at `url` from the Sources tab. */
const addSource = async (user: User, url: string) => {
  await user.click(
    screen.getByRole('button', { name: t('preload.sources.add') })
  )

  const dialog = await screen.findByRole('dialog')
  const field = within(dialog).getByRole('textbox')

  await user.clear(field)
  await user.type(field, url)
  await user.click(
    within(dialog).getByRole('button', { name: t('preload.addSource.check') })
  )
  await user.click(
    await within(dialog).findByRole('button', {
      name: t('preload.addSource.confirm')
    })
  )
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
}

const openSources = async () => {
  const user = userEvent.setup()

  await renderApp('/preload')
  await screen.findByRole('article', { name: 'StikDebug' })
  await user.click(screen.getByRole('tab', { name: t('preload.tabs.sources') }))

  return user
}

describe('SideStore links', () => {
  it('adds a source you added to SideStore by its code, and offers none for the built-in ones', async () => {
    const user = await openSources()

    expect(
      within(await sourceRow('SideStore')).queryByRole('button', {
        name: t('sidestore.addSource')
      })
    ).toBeNull()

    await addSource(user, 'https://example.com/apps.json')
    await user.click(
      within(await sourceRow('Example Community Repo')).getByRole('button', {
        name: t('sidestore.addSource')
      })
    )

    const dialog = await screen.findByRole('dialog')

    expect(
      within(dialog).getByRole('img', { name: t('sidestore.qrLabel') })
    ).toBeDefined()
    expect(
      within(dialog).getByText(
        'sidestore://source?url=https%3A%2F%2Fexample.com%2Fapps.json'
      )
    ).toBeDefined()
  })

  it('goes through every source you added with Add all, one code after another', async () => {
    const user = await openSources()

    await addSource(user, 'https://example.com/apps.json')
    await addSource(user, 'https://example.org/more.json')
    await user.click(
      screen.getByRole('button', { name: t('sidestore.addAll') })
    )

    const dialog = await screen.findByRole('dialog')

    expect(
      within(dialog).getByText(t('sidestore.step', { at: 1, count: 2 }))
    ).toBeDefined()
    await user.click(
      within(dialog).getByRole('button', { name: t('sidestore.next') })
    )
    expect(
      within(dialog).getByText(
        'sidestore://source?url=https%3A%2F%2Fexample.org%2Fmore.json'
      )
    ).toBeDefined()
  })

  it('installs an app with SideStore from its details, in the version picked, and goes back', async () => {
    const user = await openSources()

    await addSource(user, 'https://example.com/apps.json')
    await user.click(screen.getByRole('tab', { name: t('preload.tabs.apps') }))
    await user.click(
      await screen.findByRole('button', {
        name: t('preload.browse.details', { name: 'PixelPlay' })
      })
    )

    const details = await screen.findByRole('dialog')

    await user.click(
      within(details).getByRole('button', {
        name: new RegExp(t('preload.detail.version'))
      })
    )
    await user.click(await screen.findByRole('option', { name: '2.0.4' }))
    await user.click(
      within(details).getByRole('button', { name: t('sidestore.install') })
    )

    expect(
      await within(details).findByText(/^sidestore:\/\/install\?url=.*2\.0\.4/)
    ).toBeDefined()
    await user.click(
      within(details).getByRole('button', { name: t('sidestore.back') })
    )
    expect(
      within(details).getByRole('button', { name: t('preload.detail.add') })
    ).toBeDefined()
  })

  it('opens a catalog app from its card, with its releases, and installs it with SideStore; not SideStore itself', async () => {
    const user = userEvent.setup()

    await renderApp('/preload')
    await user.click(
      await screen.findByRole('button', {
        name: t('preload.browse.details', { name: 'StikDebug' })
      })
    )

    const details = await screen.findByRole('dialog')

    await user.click(
      await within(details).findByRole('button', {
        name: t('sidestore.install')
      })
    )
    expect(
      await within(details).findByText(
        /^sidestore:\/\/install\?url=https%3A%2F%2Fexample\.com%2Fstikdebug%2Fstable/
      )
    ).toBeDefined()
    await user.click(
      within(details).getByRole('button', { name: t('sidestore.done') })
    )
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())

    await user.click(
      screen.getByRole('button', {
        name: t('preload.browse.details', { name: 'SideStore' })
      })
    )

    const sideStore = await screen.findByRole('dialog')

    await within(sideStore).findByRole('button', {
      name: t('preload.detail.close')
    })
    expect(
      within(sideStore).queryByRole('button', { name: t('sidestore.install') })
    ).toBeNull()
  })

  it('adds a catalog app on the channel picked in its details', async () => {
    const user = userEvent.setup()

    await renderApp('/preload')
    await user.click(
      await screen.findByRole('button', {
        name: t('preload.browse.details', { name: 'SideStore' })
      })
    )

    const details = await screen.findByRole('dialog')

    await user.click(
      await within(details).findByRole('button', {
        name: new RegExp(t('preload.detail.version'))
      })
    )
    await user.click(
      await screen.findByRole('option', { name: 'nightly-20261018' })
    )
    await user.click(
      within(details).getByRole('button', { name: t('preload.detail.add') })
    )

    expect(
      await within(details).findByText(t('preload.detail.inList'))
    ).toBeDefined()
  })
})
