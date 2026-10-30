// The Apps page against the fake Engine over the rpc memory transport: the installed apps soonest first with their
// expiry and source, Refresh and Update (a run, then the list read again), Remove, other tools' apps, an expired
// app refreshed by hand or by itself, a failed refresh, and the automatic-refresh settings.
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { t } from '@ui/__tests__/test-i18n.ts'
import {
  renderApp,
  type TestServicesOptions
} from '@ui/__tests__/test-services.tsx'
import { AutoRefreshKey } from '@ui/state/auto-refresh/constants.ts'

const LIVECONTAINER = 'LiveContainer - BETA NOT MEANT FOR USE YET'
const AUTO_OFF = { [AutoRefreshKey.isOn]: 'false' }

const open = async (options: TestServicesOptions = {}) => {
  const user = userEvent.setup()

  await renderApp('/apps', { preferences: AUTO_OFF, ...options })
  await screen.findByRole('list', { name: t('apps.list.title') })

  return user
}

const rowOf = async (name: string) =>
  waitFor(() => {
    const row = within(screen.getByRole('list', { name: t('apps.list.title') }))
      .getAllByRole('listitem')
      .find((item) => item.textContent?.includes(name))

    if (!row) throw new Error(`no row for ${name}`)

    return row
  })

const names = () =>
  within(screen.getByRole('list', { name: t('apps.list.title') }))
    .getAllByRole('listitem')
    .map((item) => item.textContent ?? '')

describe('the Apps page', () => {
  it('lists the apps IPAForge installed, soonest first, with their expiry, source and update', async () => {
    await open()

    const rows = await waitFor(() => {
      const found = names()

      if (found.length < 3) throw new Error('not loaded')

      return found
    })

    expect(rows[0]).toContain(LIVECONTAINER)
    expect(rows[1]).toContain('SideStore')
    expect(rows[2]).toContain('YouTube')
    expect(rows[1]).toContain(
      t('apps.from', { source: t('preload.sources.catalogName') })
    )
    expect(rows[2]).toContain(t('apps.from', { source: 'YouTube.ipa' }))
    expect(rows[0]).toContain(t('apps.updateTo', { version: '2.1.2' }))
    expect(
      within(
        screen.getByRole('list', { name: t('apps.others.title') })
      ).getByText('Delta')
    ).toBeDefined()
  })

  it('refreshes an app: a run, then a new expiry', async () => {
    const user = await open()
    const youtube = await rowOf('YouTube')

    await user.click(
      within(youtube).getByRole('button', { name: t('apps.refresh') })
    )
    await waitFor(async () =>
      expect((await rowOf('YouTube')).textContent).toMatch(/Expires in 7 days/)
    )
  })

  it('cancels a refresh from the Apps page while it runs', async () => {
    // With two teams the run stops to ask which one: it's still going when Cancel is pressed.
    const user = await open({ scenario: 'two-teams' })
    const youtube = await rowOf('YouTube')

    await user.click(
      within(youtube).getByRole('button', { name: t('apps.refresh') })
    )
    await user.click(
      await screen.findByRole('button', { name: t('apps.cancelRefresh') })
    )

    await waitFor(() =>
      expect(
        screen.queryByRole('button', { name: t('apps.cancelRefresh') })
      ).toBeNull()
    )
  })

  it('installs SideStore again on Refresh, saying why, so its own screen shows the new date', async () => {
    const user = await open()

    await user.click(
      within(await rowOf('SideStore')).getByRole('button', {
        name: t('apps.refresh')
      })
    )
    await waitFor(async () =>
      expect((await rowOf('SideStore')).textContent).toMatch(
        /Expires in 7 days/
      )
    )
  })

  it('updates an app from its source to the newer version', async () => {
    const user = await open()

    await user.click(
      within(await rowOf(LIVECONTAINER)).getByRole('button', {
        name: t('apps.update')
      })
    )
    await waitFor(async () =>
      expect((await rowOf(LIVECONTAINER)).textContent).toContain('2.1.2')
    )
    expect((await rowOf(LIVECONTAINER)).textContent).not.toContain(
      t('apps.updateTo', { version: '2.1.2' })
    )
  })

  it('removes an app after asking', async () => {
    const user = await open()

    await user.click(
      within(await rowOf('YouTube')).getByRole('button', {
        name: t('apps.removeApp', { name: 'YouTube' })
      })
    )

    const dialog = await screen.findByRole('alertdialog')

    await user.click(
      within(dialog).getByRole('button', { name: t('apps.remove') })
    )
    await waitFor(() =>
      expect(names().some((row) => row.includes('YouTube'))).toBe(false)
    )
  })

  it('says when an app expired, and refreshes it on request', async () => {
    const user = await open({ scenario: 'apps-expired' })

    await user.click(
      await screen.findByRole('button', {
        name: t('apps.expired.refresh', { count: 1 })
      })
    )
    await waitFor(async () =>
      expect((await rowOf('YouTube')).textContent).toMatch(/Expires in 7 days/)
    )
    expect(screen.queryByText(t('apps.expired.title', { count: 1 }))).toBeNull()
  })

  it('lists an app whose profile iOS removed as expired, and refreshes it on request', async () => {
    const user = await open({ scenario: 'apps-profile-gone' })

    expect((await rowOf('YouTube')).textContent).toContain(
      t('apps.expiry.gone')
    )
    await user.click(
      await screen.findByRole('button', {
        name: t('apps.expired.refresh', { count: 1 })
      })
    )
    await waitFor(async () =>
      expect((await rowOf('YouTube')).textContent).toMatch(/Expires in 7 days/)
    )
  })

  it('refreshes an expired app by itself when automatic refresh is on', async () => {
    await renderApp('/apps', { scenario: 'apps-expired' })

    await waitFor(async () =>
      expect((await rowOf('YouTube')).textContent).toMatch(/Expires in 7 days/)
    )
  })

  it('shows nothing to refresh before anything is installed', async () => {
    await renderApp('/apps', { scenario: 'no-apps', preferences: AUTO_OFF })

    expect(await screen.findByText(t('apps.list.empty'))).toBeDefined()
  })

  it('turns automatic refresh on from its settings', async () => {
    const user = await open()
    const toggle = screen.getByRole('switch', { name: t('apps.auto.toggle') })

    expect((toggle as HTMLInputElement).checked).toBe(false)
    await user.click(toggle)
    expect((toggle as HTMLInputElement).checked).toBe(true)
    expect(screen.getByText(t('apps.facts.autoOn', { days: 2 }))).toBeDefined()
  })

  it('refreshes apps IPAForge installed on another computer with a new profile, even one from an .ipa', async () => {
    const user = await open()
    const game = await rowOf('MyGame')

    expect(within(game).queryByText(t('apps.needsIpa'))).toBeNull()

    await user.click(
      within(game).getByRole('button', { name: t('apps.refresh') })
    )
    await waitFor(async () =>
      expect((await rowOf('MyGame')).textContent).toMatch(/Expires in 7 days/)
    )
    await user.click(
      within(await rowOf('StikDebug')).getByRole('button', {
        name: t('apps.refresh')
      })
    )
    await waitFor(async () =>
      expect((await rowOf('StikDebug')).textContent).toMatch(
        /Expires in 7 days/
      )
    )
  })

  it('says on the Apps page when a refresh fails, and why, until dismissed', async () => {
    const user = await open({ scenario: 'app-id-quota' })

    await user.click(
      within(await rowOf('YouTube')).getByRole('button', {
        name: t('apps.refresh')
      })
    )
    const reason = t('apps.failed.title', {
      reason: t('errors.apple.app_id_quota.title')
    })

    expect(await screen.findByText(reason)).toBeDefined()

    await user.click(
      screen.getByRole('button', { name: t('apps.failed.dismiss') })
    )
    await waitFor(() => expect(screen.queryByText(reason)).toBeNull())
  })
})
