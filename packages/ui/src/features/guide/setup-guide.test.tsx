import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { t } from '@ui/__tests__/test-i18n.ts'
import { renderApp } from '@ui/__tests__/test-services.tsx'
import type { TranslationKey } from '@ui/i18n/setup/types.ts'
import { GuideKey } from '@ui/state/guide/constants.ts'

const open = { [GuideKey.status]: 'open' }
const heading = (key: TranslationKey) =>
  screen.findByRole('heading', { level: 1, name: t(key) })
const button = (key: TranslationKey) =>
  screen.getByRole('button', { name: t(key) })

describe('setup guide', () => {
  afterEach(() => vi.restoreAllMocks())

  it('goes through every step, installing SideStore, then shows the pages with the tour', async () => {
    const user = userEvent.setup()
    const { services } = await renderApp('/install', { preferences: open })

    await heading('guide.welcome.title')
    expect(
      screen.queryByRole('navigation', { name: t('shell.navigation') })
    ).toBeNull()
    await user.click(button('guide.welcome.start'))

    await heading('guide.computer.title')
    await waitFor(() =>
      expect(button('guide.continue').hasAttribute('disabled')).toBe(false)
    )
    await user.click(button('guide.continue'))

    await heading('guide.iphone.title')
    await waitFor(() =>
      expect(button('guide.continue').hasAttribute('disabled')).toBe(false)
    )
    await user.click(button('guide.continue'))

    await heading('guide.appleid.title')
    await waitFor(() =>
      expect(button('guide.continue').hasAttribute('disabled')).toBe(false)
    )
    await user.click(button('guide.continue'))

    // Install SideStore: the run in the step, with the team the Apple ID step picked; Continue once it's done.
    await heading('guide.install.title')
    const install = await within(screen.getByRole('main')).findByRole(
      'button',
      {
        name: t('install.home.install', {
          app: t('install.variant.sidestore.title')
        })
      }
    )
    await waitFor(() => expect(install.hasAttribute('disabled')).toBe(false))
    await user.click(install)
    await waitFor(
      () =>
        expect(button('guide.continue').hasAttribute('disabled')).toBe(false),
      { timeout: 4000 }
    )
    await user.click(button('guide.continue'))

    await heading('guide.onphone.title')
    await user.click(button('guide.continue'))

    await heading('guide.around.title')
    await user.click(button('guide.around.showMe'))

    expect(
      await screen.findByRole('navigation', { name: t('shell.navigation') })
    ).toBeDefined()
    expect(services.preferences.read(GuideKey.status)).toBe('finished')
    // The tour starts as the guide closes, at Install.
    expect(
      await screen.findByRole('dialog', { name: t('tour.install.title') })
    ).toBeDefined()
  })

  it("holds Continue while the computer isn't ready, and says how to fix it on this system", async () => {
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
    )
    const user = userEvent.setup()
    const { links } = await renderApp('/install', {
      preferences: open,
      scenario: 'computer-not-ready'
    })
    await user.click(
      await screen.findByRole('button', { name: t('guide.welcome.start') })
    )

    expect(
      await screen.findByText(t('guide.computer.service.fixWindows'))
    ).toBeDefined()
    expect(
      screen.getByText(t('guide.computer.clock.fix', { minutes: 4 }))
    ).toBeDefined()
    expect(button('guide.continue').hasAttribute('disabled')).toBe(true)
    await user.click(button('guide.computer.service.openStore'))
    expect(links.opened).toContain(
      'https://apps.microsoft.com/detail/9np83lwlpz9k'
    )
  })

  it('goes from Install SideStore straight to the last step on Not now', async () => {
    const user = userEvent.setup()
    await renderApp('/install', {
      preferences: { ...open, [GuideKey.step]: 'install' }
    })
    await heading('guide.install.title')
    await user.click(button('guide.install.notNow'))

    expect(await heading('guide.around.title')).toBeDefined()
  })

  it('finishes later with a banner that continues where it was', async () => {
    const user = userEvent.setup()
    await renderApp('/install', { preferences: open })
    await user.click(
      await screen.findByRole('button', { name: t('guide.welcome.start') })
    )
    await heading('guide.computer.title')
    await user.click(button('guide.later'))

    const banner = await screen.findByRole('region', {
      name: t('guide.banner.label')
    })
    expect(banner.textContent).toContain(
      t('guide.banner.text', { done: 1, total: 7 })
    )
    await user.click(
      within(banner).getByRole('button', { name: t('guide.banner.continue') })
    )
    await heading('guide.computer.title')
  })

  it('opens by itself at launch while no Apple ID is saved', async () => {
    await renderApp('/install', {
      scenario: 'no-accounts',
      guideOpensByItself: true
    })

    expect(await heading('guide.welcome.title')).toBeDefined()
  })

  it('stays closed at launch when an Apple ID is saved', async () => {
    await renderApp('/install', { guideOpensByItself: true })

    expect(
      await screen.findByRole('button', { name: t('topBar.tour') })
    ).toBeDefined()
    expect(
      screen.queryByRole('heading', { name: t('guide.welcome.title') })
    ).toBeNull()
  })

  it('runs again from Settings', async () => {
    const user = userEvent.setup()
    await renderApp('/settings')
    await user.click(
      await screen.findByRole('button', { name: t('settings.guide.run') })
    )

    expect(await heading('guide.welcome.title')).toBeDefined()
  })
})
