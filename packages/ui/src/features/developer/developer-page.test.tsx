// The Developer Portal against the fake Engine over the rpc memory transport: the tabs with their counts, the
// certificates with who made them and what they sign, revoking one, App IDs with the unused one deleted, the
// device's profiles with the unused ones removed, app groups, registered devices, and a computer without an Apple ID.
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { t } from '@ui/__tests__/test-i18n.ts'
import {
  renderApp,
  type TestServicesOptions
} from '@ui/__tests__/test-services.tsx'
import type { TranslationKey } from '@ui/i18n/setup/types.ts'

const open = async (options: TestServicesOptions = {}) => {
  const user = userEvent.setup()

  await renderApp('/developer', options)
  await screen.findByRole('heading', { name: t('nav.developer') })

  return user
}

const listOf = (key: TranslationKey) =>
  screen.findByRole('list', { name: t(key) })

const rows = async (key: TranslationKey) =>
  within(await listOf(key))
    .getAllByRole('listitem')
    .map((item) => item.textContent ?? '')

const openTab = async (
  user: ReturnType<typeof userEvent.setup>,
  key: TranslationKey
) => user.click(await screen.findByRole('tab', { name: new RegExp(t(key)) }))

describe('the Developer Portal', () => {
  it('shows the team and one tab per thing it holds, each with its count', async () => {
    await open()

    expect(
      await screen.findByText(t('portal.team.free', { name: 'Personal team' }))
    ).toBeTruthy()
    await waitFor(() =>
      expect(
        screen.getByRole('tab', { name: /Certificates/ }).textContent
      ).toContain('2')
    )
    expect(screen.getByRole('tab', { name: /App IDs/ }).textContent).toContain(
      '7'
    )
    expect(screen.getByRole('tab', { name: /Profiles/ }).textContent).toContain(
      '7'
    )
  })

  it('lists the certificates: who made each, this computer’s, and what it signs on the device', async () => {
    await open()

    const found = await waitFor(async () => {
      const list = await rows('portal.tabs.certificates')

      if (list.length < 2) throw new Error('not loaded')

      return list
    })

    expect(found[0]).toContain(t('portal.certificates.maker.thisComputer'))
    expect(found[0]).toContain(t('portal.certificates.thisComputer'))
    expect(found[0]).toMatch(/Signs .*SideStore/)
    expect(found[1]).toContain(t('portal.certificates.maker.sidestore'))
    expect(found[1]).toMatch(/Signs nothing/)
    expect(
      screen.getByText(t('portal.certificates.usedFree', { count: 2, max: 2 }))
    ).toBeTruthy()
  })

  it('revokes a certificate after naming the apps that stop opening', async () => {
    const user = await open()

    await user.click(
      await screen.findByRole('button', {
        name: t('portal.certificates.revokeOne', {
          name: t('portal.certificates.maker.thisComputer')
        })
      })
    )

    const dialog = await screen.findByRole('alertdialog')

    expect(within(dialog).getByText('SideStore')).toBeTruthy()
    expect(
      within(dialog).getByText(t('portal.revokeDialog.thisComputer'))
    ).toBeTruthy()
    await user.click(
      within(dialog).getByRole('button', {
        name: t('portal.certificates.revoke')
      })
    )
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    await waitFor(async () =>
      expect(await rows('portal.tabs.certificates')).toHaveLength(1)
    )
  })

  it('deletes an App ID no installed app uses, with the free-team caveat', async () => {
    const user = await open()

    await openTab(user, 'portal.tabs.appIds')
    expect(
      await screen.findByText(/8 left this week · next one frees on/)
    ).toBeTruthy()

    const unused = await waitFor(async () => {
      const row = within(await listOf('portal.tabs.appIds'))
        .getAllByRole('listitem')
        .find((item) => item.textContent?.includes(t('portal.appIds.unused')))

      if (!row) throw new Error('no unused App ID')

      return row
    })

    expect(unused?.textContent).toContain('com.example.oldgame')
    expect(await rows('portal.tabs.appIds')).toHaveLength(7)
    await user.click(within(unused).getByRole('button', { name: /Delete/ }))

    const dialog = await screen.findByRole('alertdialog')

    expect(within(dialog).getByText(t('portal.deleteDialog.free'))).toBeTruthy()
    await user.click(
      within(dialog).getByRole('button', { name: t('portal.appIds.delete') })
    )
    await waitFor(async () =>
      expect(await rows('portal.tabs.appIds')).toHaveLength(6)
    )
  })

  it('removes the expired and unused profiles from the device', async () => {
    const user = await open()

    await openTab(user, 'portal.tabs.profiles')
    await waitFor(async () =>
      expect(await rows('portal.tabs.profiles')).toHaveLength(7)
    )

    const expired = within(await listOf('portal.tabs.profiles'))
      .getAllByRole('listitem')
      .find((item) => item.textContent?.includes(t('portal.expired')))

    expect(expired?.textContent).toContain(t('portal.profiles.noApp'))
    await user.click(
      screen.getByRole('button', { name: t('portal.profiles.removeUnused') })
    )

    const dialog = await screen.findByRole('alertdialog')

    await user.click(
      within(dialog).getByRole('button', { name: t('portal.profiles.remove') })
    )
    await waitFor(async () =>
      expect(await rows('portal.tabs.profiles')).toHaveLength(6)
    )
    expect(
      screen
        .getByRole('button', { name: t('portal.profiles.removeUnused') })
        .hasAttribute('disabled')
    ).toBe(true)
  })

  it('lists the app groups and the registered devices, the connected one tagged', async () => {
    const user = await open()

    await openTab(user, 'portal.tabs.groups')
    await waitFor(async () =>
      expect(await rows('portal.tabs.groups')).toHaveLength(2)
    )
    await openTab(user, 'portal.tabs.devices')

    const devices = await waitFor(async () => {
      const list = await rows('portal.tabs.devices')

      if (list.length < 2) throw new Error('not loaded')

      return list
    })

    expect(devices[0]).toContain(t('portal.devices.connected'))
    expect(devices[1]).not.toContain(t('portal.devices.connected'))
  })

  it('asks for an Apple ID when none is saved', async () => {
    await open({ scenario: 'no-accounts' })

    expect(await screen.findByText(t('portal.noAccount.title'))).toBeTruthy()
    expect(screen.queryByRole('tab')).toBeNull()
  })
})
