// Apple TVs and Vision Pros paired by code on the Devices page, against the fake Engine: their cards, what each
// needs when it isn't ready (back on the network, paired again, Developer Mode), and Forget; installing to them comes
// later, so Install says so.
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { t } from '@ui/__tests__/test-i18n.ts'
import { renderApp } from '@ui/__tests__/test-services.tsx'
import { FAKE_TV } from '@ui/services/engine/fake/fake-data.ts'
import { selectionKeys } from '@ui/state/selection/constants.ts'

const card = async (name: string) => {
  const heading = await screen.findByRole('heading', { name })
  const element = heading.closest('[class*="card"]')
  if (!(element instanceof HTMLElement)) throw new Error(`no card for ${name}`)
  return element
}

describe('Apple TV and Vision Pro on the Devices page', () => {
  it('shows a paired Apple TV with its model, tvOS and how it is paired, without the iPhone-only parts', async () => {
    await renderApp('/devices', { scenario: 'paired-tv' })
    const tv = await card('Living Room')

    expect(
      await within(tv).findByText('Apple TV 4K (3rd generation)')
    ).toBeDefined()
    expect(await within(tv).findByText(t('devices.os.tv'))).toBeDefined()
    expect(within(tv).getByText(t('devices.pairedByCode'))).toBeDefined()
    expect(
      within(tv).queryByRole('button', { name: t('devices.savePairing') })
    ).toBeNull()
  })

  it('says a Vision Pro off the network should be put on and unlocked', async () => {
    await renderApp('/devices', { scenario: 'paired-tv' })
    const vision = await card('Studio Vision Pro')

    expect(
      within(vision).getByText(
        t('devices.notice.offNetwork.title', { name: 'Studio Vision Pro' })
      )
    ).toBeDefined()
    expect(
      within(vision).getByText(t('devices.notice.offNetwork.vision'))
    ).toBeDefined()
  })

  it('asks to pair an Apple TV again when it refuses its pairing, and opens the dialog for it', async () => {
    const user = userEvent.setup()
    await renderApp('/devices', { scenario: 'tv-updated' })
    const tv = await card('Living Room')
    await user.click(
      await within(tv).findByRole('button', {
        name: t('devices.notice.pairAgain.action')
      })
    )

    expect(
      await screen.findByRole('dialog', {
        name: t('pairByCode.titleAgain', { name: 'Living Room' })
      })
    ).toBeDefined()
  })

  it('forgets a paired device after asking, and keeps it on Cancel', async () => {
    const user = userEvent.setup()
    await renderApp('/devices', { scenario: 'paired-tv' })
    const tv = await card('Living Room')
    const forget = () =>
      user.click(
        within(tv).getByRole('button', { name: t('devices.forget.action') })
      )
    await forget()
    await user.click(
      within(tv).getByRole('button', { name: t('prompts.cancel') })
    )
    expect(
      within(tv).queryByText(t('devices.forget.title', { name: 'Living Room' }))
    ).toBeNull()

    await forget()
    expect(within(tv).getByText(t('devices.forget.body'))).toBeDefined()
    await user.click(
      within(tv).getByRole('button', { name: t('devices.forget.confirm') })
    )
    await waitFor(() =>
      expect(screen.queryByRole('heading', { name: 'Living Room' })).toBeNull()
    )
    expect(
      screen.getByRole('heading', { name: 'Studio Vision Pro' })
    ).toBeDefined()
  })

  it("doesn't install to an Apple TV yet, and says so", async () => {
    await renderApp('/', {
      scenario: 'paired-tv',
      preferences: { [selectionKeys.device]: FAKE_TV }
    })

    expect(
      await screen.findByText(t('install.readiness.notYetTv'))
    ).toBeDefined()
    expect(
      screen
        .getByRole('button', {
          name: t('install.home.install', {
            app: t('install.variant.sidestore.title')
          })
        })
        .hasAttribute('disabled')
    ).toBe(true)
  })
})
