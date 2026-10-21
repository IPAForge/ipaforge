import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { t } from '@ui/__tests__/test-i18n.ts'
import { renderApp } from '@ui/__tests__/test-services.tsx'
import type { TranslationKey } from '@ui/i18n/setup/types.ts'
import { sections } from '@ui/sections.ts'

const navigationName = { name: t('shell.navigation') }
const sidebar = () => screen.getByRole('navigation', navigationName)
/** The router renders asynchronously: wait for the shell before querying it. */
const findSidebar = () => screen.findByRole('navigation', navigationName)
const manageKeys = [
  'nav.devices',
  'nav.accounts',
  'nav.developer',
  'nav.logs',
  'nav.settings'
] as const satisfies readonly TranslationKey[]
const linkLabels = (container: HTMLElement) =>
  within(container)
    .getAllByRole('link')
    .map((link) => link.textContent)

describe('AppShell', () => {
  it('has banner, navigation and main landmarks', async () => {
    await renderApp('/devices')
    expect(await findSidebar()).toBeDefined()
    expect(screen.getByRole('banner')).toBeDefined()
    expect(screen.getByRole('main')).toBeDefined()
  })

  it('credits its maker at the foot of the sidebar', async () => {
    await renderApp('/devices')
    const madeWith = await screen.findByText(t('shell.credit.madeWith'))
    const credit = madeWith.closest('footer')
    expect(credit?.textContent).toContain('© 2026 Dan Motpan')
  })

  it('lists every section in the sidebar, in order', async () => {
    await renderApp('/devices')
    const links = within(await findSidebar()).getAllByRole('link')
    expect(links.map((link) => link.textContent)).toEqual(
      sections.map((section) => t(section.labelKey))
    )
    expect(links.map((link) => link.getAttribute('href'))).toEqual(
      sections.map((section) => section.path)
    )
  })

  it('puts Install, Preload and Apps first, then the Manage group after a separator', async () => {
    await renderApp('/install')
    const nav = await findSidebar()
    const [primary, manage] = within(nav).getAllByRole('list')

    expect(linkLabels(primary as HTMLElement)).toEqual([
      t('nav.install'),
      t('nav.preload'),
      t('nav.apps')
    ])
    expect(within(nav).getByRole('list', { name: t('nav.group.manage') })).toBe(
      manage
    )
    expect(linkLabels(manage as HTMLElement)).toEqual(
      manageKeys.map((key) => t(key))
    )
    expect(within(nav).getAllByRole('separator')).toHaveLength(1)
  })

  it('marks only the active section as the current page', async () => {
    await renderApp('/developer')
    const active = await within(await findSidebar()).findByRole('link', {
      current: 'page'
    })
    expect(active.textContent).toBe(t('nav.developer'))
    expect(
      within(sidebar()).getAllByRole('link', { current: 'page' })
    ).toHaveLength(1)
  })

  it('moves the highlight when another section is chosen', async () => {
    const user = userEvent.setup()
    await renderApp('/devices')
    await user.click(
      within(await findSidebar()).getByRole('link', { name: t('nav.logs') })
    )
    await waitFor(() =>
      expect(
        within(sidebar()).getByRole('link', { current: 'page' }).textContent
      ).toBe(t('nav.logs'))
    )
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(
      t('nav.logs')
    )
  })

  it('tabs through the skip link, the top bar pickers, the tour, then the sections in order', async () => {
    const user = userEvent.setup()
    await renderApp('/devices')
    await findSidebar()

    await user.tab()
    expect(document.activeElement?.textContent).toBe(t('shell.skipToContent'))
    for (const labelKey of ['topBar.device', 'topBar.account'] as const) {
      await user.tab()
      expect(
        document.activeElement?.getAttribute('aria-haspopup')
      ).not.toBeNull()
      expect(document.activeElement?.textContent).toContain(t(labelKey))
    }
    await user.tab()
    expect(document.activeElement?.getAttribute('aria-label')).toBe(
      t('topBar.tour')
    )
    for (const section of sections) {
      await user.tab()
      expect(document.activeElement?.textContent).toBe(t(section.labelKey))
    }
  })

  it('opens a section from the keyboard', async () => {
    const user = userEvent.setup()
    await renderApp('/devices')
    within(await findSidebar())
      .getByRole('link', { name: t('nav.install') })
      .focus()
    await user.keyboard('{Enter}')
    await waitFor(() =>
      expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(
        t('install.title')
      )
    )
  })
})
