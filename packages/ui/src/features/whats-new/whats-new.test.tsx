import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { t } from '@ui/__tests__/test-i18n.ts'
import { renderApp } from '@ui/__tests__/test-services.tsx'
import {
  RELEASE_NOTES,
  WHATS_NEW_SEEN_KEY
} from '@ui/features/whats-new/constants.ts'
import { selectionKeys } from '@ui/state/selection/constants.ts'

const [LATEST, PREVIOUS] = RELEASE_NOTES
const latest = LATEST?.version ?? ''
const previous = PREVIOUS?.version ?? ''

const dialogTitle = { name: t('whatsNew.dialog.title') }

describe("What's new", () => {
  it('opens once after an update, then remembers the version as seen', async () => {
    const user = userEvent.setup()
    const { services } = await renderApp('/install', {
      appVersion: latest,
      preferences: { [WHATS_NEW_SEEN_KEY]: previous }
    })

    const dialog = await screen.findByRole('dialog', dialogTitle)
    expect(dialog.textContent).toContain(LATEST?.lead)
    // A section per kind of note: New, Changed and Fixed.
    expect(
      within(dialog)
        .getAllByRole('heading', { level: 3 })
        .map((heading) => heading.textContent)
    ).toEqual([
      t('whatsNew.kind.new'),
      t('whatsNew.kind.changed'),
      t('whatsNew.kind.fixed')
    ])

    await user.click(
      within(dialog).getByRole('button', { name: t('whatsNew.dialog.close') })
    )
    await waitFor(() =>
      expect(screen.queryByRole('dialog', dialogTitle)).toBeNull()
    )
    expect(services.preferences.read(WHATS_NEW_SEEN_KEY)).toBe(latest)
  })

  it('opens after an update from a version that never showed it', async () => {
    await renderApp('/install', {
      appVersion: latest,
      preferences: { [selectionKeys.device]: 'UDID1' }
    })

    expect(await screen.findByRole('dialog', dialogTitle)).toBeDefined()
  })

  it("stays closed on a new install's first launch, and on a version already seen", async () => {
    const first = await renderApp('/install', { appVersion: latest })
    await screen.findByRole('navigation', { name: t('shell.navigation') })

    expect(screen.queryByRole('dialog', dialogTitle)).toBeNull()
    expect(first.services.preferences.read(WHATS_NEW_SEEN_KEY)).toBe(latest)
    first.unmount()

    await renderApp('/install', {
      appVersion: latest,
      preferences: { [WHATS_NEW_SEEN_KEY]: latest }
    })
    await screen.findByRole('navigation', { name: t('shell.navigation') })
    expect(screen.queryByRole('dialog', dialogTitle)).toBeNull()
  })

  it('goes to every version from the dialog, the one IPAForge runs marked', async () => {
    const user = userEvent.setup()
    const { history } = await renderApp('/install', {
      appVersion: latest,
      preferences: { [WHATS_NEW_SEEN_KEY]: previous }
    })

    await user.click(
      await screen.findByRole('button', {
        name: t('whatsNew.dialog.everyVersion')
      })
    )

    await waitFor(() => expect(history.location.pathname).toBe('/whats-new'))
    const versions = await screen.findAllByRole('heading', { level: 2 })
    expect(versions.map((heading) => heading.textContent)).toEqual(
      RELEASE_NOTES.map((notes) => notes.version)
    )
    expect(screen.getAllByText(t('whatsNew.page.current'))).toHaveLength(1)
  })

  it('is at the foot of the sidebar, with the version, on one line', async () => {
    const user = userEvent.setup()
    const { history } = await renderApp('/install', { appVersion: latest })

    const link = (await screen.findByText(t('whatsNew.link'))).closest('a')
    if (!link) throw new Error('no link')
    expect(link.textContent).toBe(`${t('whatsNew.link')}${latest}`)
    await user.click(link)

    await waitFor(() => expect(history.location.pathname).toBe('/whats-new'))
    expect(link.getAttribute('aria-current')).toBe('page')
  })
})
