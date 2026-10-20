// Repair SideStore against the fake Engine: opened from SideStore's row in Apps, the checks coming in one by one
// (with "can't tell" where IPAForge can't see), the fixes needed and offered, one repair run, the checks again, and
// a SideStore another Apple ID signed (not installed again) or none at all.
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, onTestFinished, vi } from 'vitest'

import { t } from '@ui/__tests__/test-i18n.ts'
import {
  renderApp,
  type TestServicesOptions
} from '@ui/__tests__/test-services.tsx'
import { AutoRefreshKey } from '@ui/state/auto-refresh/constants.ts'

const AUTO_OFF = { [AutoRefreshKey.isOn]: 'false' }

const checks = () => screen.findByRole('list', { name: t('repair.checks') })

/** Results come in one by one: waits for every check to be in. */
const REVEALED = { timeout: 3000 }

/** The system asks for reduced motion: the results come in at once (a long test stays fast on slow runners). */
const withReducedMotion = () => {
  const original = window.matchMedia.bind(window)
  const spy = vi
    .spyOn(window, 'matchMedia')
    .mockImplementation((query) =>
      query.includes('prefers-reduced-motion')
        ? { ...original(query), matches: true }
        : original(query)
    )

  onTestFinished(() => spy.mockRestore())
}

/** Repair SideStore, its results coming in at once: the reveal is checked on its own, from Apps. */
const open = async (options: TestServicesOptions = {}) => {
  const user = userEvent.setup()

  withReducedMotion()
  await renderApp('/apps/sidestore', { preferences: AUTO_OFF, ...options })
  await screen.findByRole('heading', { name: t('repair.title') })

  return user
}

/** A check's line once its result is in. */
const lineOf = (title: string) =>
  waitFor(async () => {
    const line = within(await checks())
      .getAllByRole('listitem')
      .find((item) => item.textContent?.includes(title))

    if (!line || line.hasAttribute('data-checking'))
      throw new Error(`no result for ${title}`)

    return line
  }, REVEALED)

describe('Repair SideStore', () => {
  it("opens from SideStore's row in Apps, and shows every check waiting before the results", async () => {
    const user = userEvent.setup()

    await renderApp('/apps', { preferences: AUTO_OFF })
    await user.click(
      await screen.findByRole('button', { name: t('repair.open') })
    )

    expect(
      await screen.findByRole('heading', { name: t('repair.title') })
    ).toBeDefined()
    expect(
      within(await checks()).getAllByText(t('repair.checkingTag')).length
    ).toBeGreaterThan(0)
    // Then the results come in one by one: some in, some still waiting.
    await waitFor(() => {
      const lines = within(
        screen.getByRole('list', { name: t('repair.checks') })
      ).getAllByRole('listitem')
      const waiting = lines.filter((line) => line.hasAttribute('data-checking'))

      expect(waiting.length).toBeGreaterThan(0)
      expect(waiting.length).toBeLessThan(lines.length)
    }, REVEALED)
  })

  it('says SideStore is working when every check passes', async () => {
    await open()

    expect(
      await screen.findByText(t('repair.fine.title'), {}, REVEALED)
    ).toBeDefined()
    expect(
      within(await lineOf(t('repair.signing.title'))).getByText(t('repair.ok'))
    ).toBeDefined()
    expect(
      within(await lineOf(t('repair.remote.title'))).getByText(t('repair.ok'))
    ).toBeDefined()
    expect(
      screen.getByRole('list', { name: t('repair.manual.title') })
    ).toBeDefined()
  })

  it('says when the device no longer accepts the remote pairing', async () => {
    await open({ scenario: 'sidestore-broken' })

    expect(
      within(await lineOf(t('repair.remote.title'))).getByText(
        t('repair.remote.rejectedTag')
      )
    ).toBeDefined()
  })

  it('installs SideStore again when it lost its certificate, then checks again', async () => {
    const user = await open({ scenario: 'sidestore-broken' })

    expect(
      await screen.findByText(t('repair.plan.reinstall'), {}, REVEALED)
    ).toBeDefined()
    expect(
      within(await lineOf(t('repair.own.title'))).getByText(
        t('repair.own.missingTag')
      )
    ).toBeDefined()

    await user.click(
      screen.getByRole('button', { name: t('repair.plan.start') })
    )
    await screen.findByRole('heading', {
      name: t('repair.run.title.completed')
    })
    await user.click(
      screen.getByRole('button', { name: t('install.done.done') })
    )

    expect(
      await screen.findByText(t('repair.fine.title'), {}, REVEALED)
    ).toBeDefined()
  }, 15_000)

  it("says what it can't tell, and only runs an offered fix once it's picked", async () => {
    const user = await open({ scenario: 'sidestore-unknown' })

    expect(
      within(await lineOf(t('repair.signing.title'))).getByText(
        t('repair.unknown')
      )
    ).toBeDefined()
    expect(
      within(await lineOf(t('repair.own.title'))).getByText(
        t('repair.own.otherTag')
      )
    ).toBeDefined()

    const start = await screen.findByRole(
      'button',
      { name: t('repair.plan.start') },
      REVEALED
    )

    expect(start.hasAttribute('disabled')).toBe(true)
    await user.click(
      screen.getByRole('checkbox', { name: t('repair.plan.offerPairing') })
    )
    expect(start.hasAttribute('disabled')).toBe(false)
  })

  it("won't install again a SideStore another Apple ID signed", async () => {
    await open({ scenario: 'sidestore-other-team' })

    expect(
      await screen.findByText(t('repair.blocked.title'), {}, REVEALED)
    ).toBeDefined()
    expect(
      screen.queryByRole('button', { name: t('repair.plan.start') })
    ).toBeNull()
  })

  it('points to Install when SideStore is not on the device', async () => {
    await open({ scenario: 'no-apps' })

    expect(
      await screen.findByRole(
        'button',
        { name: t('repair.notInstalled.install') },
        REVEALED
      )
    ).toBeDefined()
  })
})
