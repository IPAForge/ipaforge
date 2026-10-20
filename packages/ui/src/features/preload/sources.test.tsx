// App sources on the Preload page: Browse apps (every source's apps, a filter, search and details) and the Sources
// tab (add, turn off, refresh and remove), against the fake Engine over the rpc memory transport.
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { t } from '@ui/__tests__/test-i18n.ts'
import { renderApp } from '@ui/__tests__/test-services.tsx'
import type { FakeScenarioId } from '@ui/services/engine/fake/types.ts'

type User = ReturnType<typeof userEvent.setup>

const COMMUNITY = 'Example Community Repo'

const open = async (scenario: FakeScenarioId = 'happy') => {
  const user = userEvent.setup()

  await renderApp('/preload', { scenario })
  await screen.findByRole('article', { name: 'StikDebug' })

  return user
}

const cards = () =>
  screen
    .queryAllByRole('article')
    .map((card) => card.getAttribute('aria-label'))

const sourcesTab = (user: User) =>
  user.click(
    screen.getByRole('tab', {
      name: new RegExp(`^${t('preload.tabs.sources')}`)
    })
  )

const appsTab = (user: User) =>
  user.click(
    screen.getByRole('tab', { name: new RegExp(`^${t('preload.tabs.apps')}`) })
  )

const sourceRow = async (name: string) =>
  waitFor(() => {
    const item = within(
      screen.getByRole('list', { name: t('preload.sources.list') })
    )
      .getAllByRole('listitem')
      .find((candidate) => candidate.textContent?.includes(name))

    if (!item) throw new Error(`no source ${name}`)
    return item
  })

/** Types a link into Add source and presses Check. */
const checkSource = async (user: User, url: string) => {
  const dialog = await screen.findByRole('dialog')
  const field = within(dialog).getByRole('textbox')

  await user.clear(field)
  await user.type(field, url)
  await user.click(
    within(dialog).getByRole('button', { name: t('preload.addSource.check') })
  )

  return dialog
}

describe('Browse apps', () => {
  it("lists the catalog's apps and SideStore's source, each app once, naming the other source", async () => {
    await open()

    expect(cards()).toEqual(
      expect.arrayContaining(['SideStore', 'LiveContainer', 'StikDebug'])
    )
    expect(cards().filter((name) => name === 'SideStore')).toHaveLength(1)
    // The card shows the first source and "+1"; the other sources are named on hover.
    expect(
      within(screen.getByRole('article', { name: 'SideStore' })).getByTitle(
        t('preload.browse.from', {
          name: t('preload.sources.catalogName'),
          others: 'SideStore Official'
        })
      ).textContent
    ).toBe(`${t('preload.sources.catalogName')} · +1`)
  })

  it('searches the apps and says when nothing matches', async () => {
    const user = await open()
    const search = screen.getByRole('searchbox', {
      name: t('preload.browse.search')
    })

    await user.type(search, 'stik')
    expect(cards()).toEqual(['StikDebug'])
    await user.clear(search)
    await user.type(search, 'zzz')
    expect(
      screen.getByText(t('preload.browse.noMatch', { query: 'zzz' }))
    ).toBeDefined()
  })
})

describe('the Sources tab', () => {
  it('lists the built-in sources, trusted, without Remove', async () => {
    const user = await open()

    await sourcesTab(user)

    const catalog = await sourceRow(t('preload.sources.catalogName'))
    const sidestore = await sourceRow('SideStore Official')

    for (const row of [catalog, sidestore]) {
      expect(within(row).getByText(t('preload.sources.builtin'))).toBeDefined()
      expect(within(row).queryByRole('button', { name: /Remove/ })).toBeNull()
    }
  })

  it('refuses an http link, an unreachable one and one that is not a source, each in words', async () => {
    const user = await open()

    await sourcesTab(user)
    await user.click(
      screen.getByRole('button', { name: t('preload.sources.add') })
    )

    let dialog = await checkSource(user, 'http://example.com/apps.json')

    expect(
      within(dialog).getByText(t('preload.addSource.notHttps'))
    ).toBeDefined()

    dialog = await checkSource(
      user,
      'https://unreachable.example.com/apps.json'
    )
    expect(
      await within(dialog).findByText(
        t('errors.catalog.app_source_unreachable.title')
      )
    ).toBeDefined()

    dialog = await checkSource(user, 'https://example.com/notsource')
    expect(
      await within(dialog).findByText(
        t('errors.catalog.app_source_invalid.title')
      )
    ).toBeDefined()

    dialog = await checkSource(user, 'https://apps.sidestore.io')
    expect(
      await within(dialog).findByText(
        t('errors.catalog.app_source_exists.title')
      )
    ).toBeDefined()
  })

  it("previews a source with a warning, adds it, and shows its apps in Browse apps; an app's details add an older version", async () => {
    const user = await open()

    await sourcesTab(user)
    await user.click(
      screen.getByRole('button', { name: t('preload.sources.add') })
    )

    const dialog = await checkSource(user, 'https://example.com/apps.json')

    expect(
      await within(dialog).findByRole('heading', {
        name: t('preload.addSource.previewTitle')
      })
    ).toBeDefined()
    expect(within(dialog).getByText(COMMUNITY)).toBeDefined()
    expect(
      within(dialog).getByText(t('preload.addSource.warningTitle'))
    ).toBeDefined()
    await user.click(
      within(dialog).getByRole('button', {
        name: t('preload.addSource.confirm')
      })
    )
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(
      within(await sourceRow(COMMUNITY)).getByText(t('preload.sources.added'))
    ).toBeDefined()

    await appsTab(user)
    await user.click(
      await screen.findByRole('button', {
        name: t('preload.browse.details', { name: 'PixelPlay' })
      })
    )

    const details = await screen.findByRole('dialog')

    expect(
      within(details).getByText(t('preload.detail.untrusted'))
    ).toBeDefined()
    await user.click(
      within(details).getByRole('button', {
        name: new RegExp(t('preload.detail.version'))
      })
    )
    await user.click(await screen.findByRole('option', { name: '2.0.4' }))
    await user.click(
      within(details).getByRole('button', { name: t('preload.detail.add') })
    )
    expect(
      await within(details).findByText(t('preload.detail.inList'))
    ).toBeDefined()
    await user.click(
      within(details).getByRole('button', { name: t('preload.detail.close') })
    )

    const list = await screen.findByRole('list', {
      name: t('preload.list.title')
    })

    await waitFor(() =>
      expect(list.textContent).toContain(
        t('preload.row.fromSource', { name: COMMUNITY })
      )
    )
  })

  it('turns a source off (its apps leave Browse apps) and removes one that was added', async () => {
    const user = await open()

    await sourcesTab(user)
    await user.click(
      within(await sourceRow(t('preload.sources.catalogName'))).getByRole(
        'switch'
      )
    )
    await appsTab(user)
    await waitFor(() => expect(cards()).not.toContain('StikDebug'))
    expect(cards()).toEqual([
      'SideStore',
      'LiveContainer - BETA NOT MEANT FOR USE YET'
    ])

    await sourcesTab(user)
    await user.click(
      screen.getByRole('button', { name: t('preload.sources.add') })
    )

    const dialog = await checkSource(user, 'https://example.com/apps.json')

    await user.click(
      await within(dialog).findByRole('button', {
        name: t('preload.addSource.confirm')
      })
    )
    await user.click(
      within(await sourceRow(COMMUNITY)).getByRole('button', {
        name: t('preload.sources.remove', { name: COMMUNITY })
      })
    )

    const confirm = await screen.findByRole('alertdialog')

    await user.click(
      within(confirm).getByRole('button', {
        name: t('preload.removeSource.confirm')
      })
    )
    await waitFor(() =>
      expect(
        screen.getByRole('list', { name: t('preload.sources.list') })
          .textContent
      ).not.toContain(COMMUNITY)
    )
  })

  it("says when a source couldn't be refreshed, still showing its apps", async () => {
    await open('source-offline')

    expect(
      await screen.findByText(
        t('preload.browse.notRefreshed.title', { name: 'SideStore Official' })
      )
    ).toBeDefined()
    expect(cards()).toContain('SideStore')
  })
})
