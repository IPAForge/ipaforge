// The Preload page end to end: the whole app over the rpc memory transport, the fake Engine reading each app as
// it is added and installing the list in one run.
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { t } from '@ui/__tests__/test-i18n.ts'
import { renderApp } from '@ui/__tests__/test-services.tsx'

type User = ReturnType<typeof userEvent.setup>

const list = () => screen.findByRole('list', { name: t('preload.list.title') })

const row = async (name: string) =>
  waitFor(async () => {
    const item = within(await list())
      .getAllByRole('listitem')
      .find((candidate) => candidate.textContent?.includes(name))
    if (!item) throw new Error(`no row for ${name}`)
    return item
  })

const addFromCatalog = async (user: User, name: string) =>
  user.click(
    within(await screen.findByRole('article', { name })).getByRole('button', {
      name: t('preload.catalog.add')
    })
  )

/** Types links into the link dialog in turn; every link but the last is refused, and the last is added. */
const addLink = async (user: User, ...urls: string[]) => {
  await user.click(
    await screen.findByRole('button', { name: t('preload.add.link') })
  )
  const dialog = await screen.findByRole('dialog')
  for (const url of urls) {
    const field = within(dialog).getByRole('textbox')
    await user.clear(field)
    await user.type(field, url)
    await user.click(
      within(dialog).getByRole('button', { name: t('preload.link.add') })
    )
  }
}

const installButton = () =>
  screen.getByRole('button', { name: /^Install( \d+ apps?)?$/ })

describe('the Preload page', () => {
  it('adds apps from the catalog, the file dialog and a link, each read by the Engine', async () => {
    const user = userEvent.setup()
    await renderApp('/preload')

    await addFromCatalog(user, 'StikDebug')
    expect((await waitFor(() => row('StikDebug'))).textContent).toContain(
      t('preload.row.updates', { from: '3.1.10', to: '3.1.15' })
    )

    await user.click(
      await screen.findByRole('button', { name: t('preload.add.choose') })
    )
    await waitFor(async () =>
      expect((await row('MyGame')).textContent).toContain(t('preload.row.new'))
    )

    await user.click(
      await screen.findByRole('button', { name: t('preload.add.link') })
    )
    const dialog = await screen.findByRole('dialog')
    await user.type(
      within(dialog).getByRole('textbox'),
      'http://example.com/Cool.ipa'
    )
    await user.click(
      within(dialog).getByRole('button', { name: t('preload.link.add') })
    )
    expect(
      await within(dialog).findByText(t('preload.link.httpsOnly'))
    ).toBeDefined()
    await user.keyboard('{Escape}')
    await addLink(user, 'https://example.com/Cool.ipa')
    await waitFor(async () =>
      expect((await row('Cool')).textContent).toContain(t('preload.row.new'))
    )

    await waitFor(() =>
      expect(installButton().hasAttribute('disabled')).toBe(false)
    )
    expect(installButton().textContent).toContain(
      t('preload.install', { count: 3 })
    )
  }, 20_000)

  it("says why an app can't be installed, and blocks Install until it is removed", async () => {
    const user = userEvent.setup()
    await renderApp('/preload')

    await addLink(user, 'https://example.com/Encrypted.ipa')
    const encrypted = await row('Encrypted')
    await waitFor(() =>
      expect(encrypted.textContent).toContain(
        t('errors.signer.encrypted_binary.title')
      )
    )
    expect(screen.getByText(t('preload.readiness.problems'))).toBeDefined()
    expect(installButton().hasAttribute('disabled')).toBe(true)

    await user.click(
      within(encrypted).getByRole('button', {
        name: t('preload.row.remove', { name: 'Encrypted.ipa' })
      })
    )
    expect(await screen.findByText(t('preload.list.empty'))).toBeDefined()
  })

  it('installs the list in one run, steps grouped by app, and starts empty after Done', async () => {
    const user = userEvent.setup()
    await renderApp('/preload')
    await addFromCatalog(user, 'Feather')
    await user.click(
      await screen.findByRole('button', { name: t('preload.add.choose') })
    )
    await row('MyGame')
    await waitFor(() =>
      expect(installButton().hasAttribute('disabled')).toBe(false)
    )

    await user.click(installButton())
    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: t('preload.run.title.completed', {
          count: 2,
          app: 'Feather and MyGame'
        })
      })
    ).toBeDefined()
    for (const group of [t('preload.run.shared'), 'Feather', 'MyGame'])
      expect(screen.getByRole('list', { name: group })).toBeDefined()

    await user.click(
      screen.getByRole('button', { name: t('install.done.done') })
    )
    expect(await screen.findByText(t('preload.list.empty'))).toBeDefined()
    // A whole run through the app: slow CI runners (Windows timers) need more than the default 5 s.
  }, 15_000)

  it('tells the Install page that apps are being installed', async () => {
    const user = userEvent.setup()
    const { history } = await renderApp('/preload')
    await addFromCatalog(user, 'Feather')
    await waitFor(() =>
      expect(installButton().hasAttribute('disabled')).toBe(false)
    )
    await user.click(installButton())

    history.push('/install')
    expect(await screen.findByText(t('preload.elsewhere.apps'))).toBeDefined()
  })

  it('signs and saves an app instead of installing it, in the folder the host asks for', async () => {
    const user = userEvent.setup()
    await renderApp('/preload')
    await addFromCatalog(user, 'Feather')
    await user.click(
      await screen.findByRole('button', { name: t('preload.add.choose') })
    )
    const game = await row('MyGame')
    await waitFor(() =>
      expect(installButton().hasAttribute('disabled')).toBe(false)
    )

    await user.click(
      within(game).getByRole('checkbox', {
        name: t('preload.row.saveInsteadOne', { name: 'MyGame' })
      })
    )
    expect(
      screen.getByText(t('preload.installAndSave', { install: 1, save: 1 }))
    ).toBeDefined()

    await user.click(installButton())
    const steps = await screen.findByRole('list', { name: 'MyGame' })
    await waitFor(() =>
      expect(steps.textContent).toContain(t('install.steps.save'))
    )
    expect(steps.textContent).not.toContain(t('install.steps.install'))
    expect(screen.getByRole('list', { name: 'Feather' }).textContent).toContain(
      t('install.steps.install')
    )
  })

  it('says Sign and save when every app is saved', async () => {
    const user = userEvent.setup()
    await renderApp('/preload')
    await user.click(
      await screen.findByRole('button', { name: t('preload.add.choose') })
    )
    const game = await row('MyGame')

    await user.click(
      within(game).getByRole('checkbox', {
        name: t('preload.row.saveInsteadOne', { name: 'MyGame' })
      })
    )

    expect(
      await screen.findByRole('button', {
        name: t('preload.signAndSave', { count: 1 })
      })
    ).toBeDefined()
  })
})
