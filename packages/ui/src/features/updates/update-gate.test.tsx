import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import type { UpdateState } from '@ipaforge/rpc'
import { t } from '@ui/__tests__/test-i18n.ts'
import { renderApp } from '@ui/__tests__/test-services.tsx'
import { createFixedUpdateSource } from '@ui/services/updates/fixed-update-source.ts'

const NEXT = '0.1.0-alpha.99'
const RELEASE = `https://github.com/IPAForge/ipaforge/releases/tag/v${NEXT}`
const FILE = `IPAForge-${NEXT}-win-x64.msi`
const FILE_URL = `https://github.com/IPAForge/ipaforge/releases/download/v${NEXT}/${FILE}`

const renderWith = (state: UpdateState) => {
  const updates = createFixedUpdateSource(state)

  return renderApp('/install', { updates }).then((app) => ({
    ...app,
    updates
  }))
}

const sidebar = () =>
  screen.queryByRole('navigation', { name: t('shell.navigation') })

describe('UpdateGate', () => {
  it('keeps the app behind the update screen while the new version downloads', async () => {
    await renderWith({
      phase: 'downloading',
      version: NEXT,
      transferred: 25_000_000,
      total: 100_000_000,
      bytesPerSecond: 5_000_000
    })

    expect(
      await screen.findByRole('main', { name: t('updates.screen.label') })
    ).toBeDefined()
    expect(
      screen.getByText(t('updates.downloading.body', { version: NEXT }))
    ).toBeDefined()
    expect(
      screen
        .getByRole('progressbar', { name: t('updates.downloading.title') })
        .getAttribute('aria-valuenow')
    ).toBe('25')
    expect(sidebar()).toBeNull()
  })

  it('says it is checking only once the check takes a moment', async () => {
    await renderWith({ phase: 'checking' })

    expect(screen.queryByText(t('updates.checking.title'))).toBeNull()
    expect(await screen.findByText(t('updates.checking.title'))).toBeDefined()
    expect(sidebar()).toBeNull()
  })

  it('after a failed update: tries again, opens the release page, or goes on with this version', async () => {
    const user = userEvent.setup()
    const { updates, links } = await renderWith({
      phase: 'failed',
      version: NEXT,
      reason: 'net::ERR_CONNECTION_RESET',
      url: RELEASE
    })

    expect(await screen.findByText('net::ERR_CONNECTION_RESET')).toBeDefined()
    await user.click(
      screen.getByRole('button', { name: t('updates.failed.retry') })
    )
    expect(updates.retries()).toBe(1)
    await user.click(
      screen.getByRole('button', { name: t('updates.failed.releasePage') })
    )
    expect(links.opened).toEqual([RELEASE])

    await user.click(
      screen.getByRole('button', { name: t('updates.failed.skip') })
    )
    await waitFor(() => expect(sidebar()).not.toBeNull())
  })

  it('lets a copy that cannot update itself download the new file', async () => {
    const user = userEvent.setup()
    const { links } = await renderWith({
      phase: 'manual',
      version: NEXT,
      packageType: 'msi',
      fileName: FILE,
      url: FILE_URL
    })

    const dialog = await screen.findByRole('alertdialog')
    expect(dialog.textContent).toContain(
      t('updates.manual.body', { package: 'msi' })
    )
    expect(dialog.textContent).toContain(FILE)
    expect(sidebar()).not.toBeNull()

    await user.click(
      screen.getByRole('button', {
        name: t('updates.manual.download', { version: NEXT })
      })
    )
    expect(links.opened).toEqual([FILE_URL])
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
  })

  it('closes the new-version note on Later', async () => {
    const user = userEvent.setup()
    await renderWith({
      phase: 'manual',
      version: NEXT,
      packageType: 'deb',
      url: RELEASE
    })

    await user.click(
      await screen.findByRole('button', { name: t('updates.manual.later') })
    )
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
  })
})
