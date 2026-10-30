// Pairing an Apple TV or Vision Pro from the Devices page, against the fake Engine: the devices showing their
// pairing screen, the code, a wrong code, too many wrong codes, a pairing screen that closes, and a refused search.
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { t } from '@ui/__tests__/test-i18n.ts'
import { renderApp } from '@ui/__tests__/test-services.tsx'
import { FAKE_PAIRING_CODE } from '@ui/services/engine/fake/fake-data.ts'
import type { FakeScenarioId } from '@ui/services/engine/fake/types.ts'

type User = ReturnType<typeof userEvent.setup>

const TV = 'Living Room'

const openPairing = async (scenario: FakeScenarioId = 'happy') => {
  const user = userEvent.setup()
  await renderApp('/devices', { scenario })
  await user.click(
    await screen.findByRole('button', { name: t('pairByCode.open') })
  )
  await screen.findByRole('dialog', { name: t('pairByCode.title') })
  return user
}

const pickTv = async (user: User) => {
  await user.click(
    await screen.findByRole('button', {
      name: t('pairByCode.pairNamed', { name: TV })
    })
  )
  return screen.findByRole('dialog', {
    name: t('pairByCode.code.title', { name: TV })
  })
}

const enterCode = async (user: User, code: string) => {
  const dialog = await screen.findByRole('dialog', {
    name: t('pairByCode.code.title', { name: TV })
  })
  const box = within(dialog).getByRole('textbox')
  await within(dialog).findByText(t('pairByCode.code.label'))
  await user.click(box)
  await user.type(box, code)
  await user.click(
    within(dialog).getByRole('button', { name: t('pairByCode.pair') })
  )
}

describe('Pair Apple TV or Vision Pro', () => {
  it('shows where to open the pairing screen, finds the devices showing it, and pairs one with its code', async () => {
    const user = await openPairing()
    const find = screen.getByRole('dialog', { name: t('pairByCode.title') })
    expect(within(find).getByText(t('pairByCode.where.tvPath'))).toBeDefined()
    expect(
      within(find).getByText(t('pairByCode.where.visionPath'))
    ).toBeDefined()
    expect(
      await within(find).findByRole('button', {
        name: t('pairByCode.pairNamed', { name: 'Studio Vision Pro' })
      })
    ).toBeDefined()

    await pickTv(user)
    await enterCode(user, FAKE_PAIRING_CODE)
    const done = await screen.findByRole('dialog', {
      name: t('pairByCode.done.title', { name: TV })
    })
    await user.click(
      within(done).getByRole('button', {
        name: t('pairByCode.done.use', { name: TV })
      })
    )

    expect(await screen.findByRole('heading', { name: TV })).toBeDefined()
    expect(
      await within(screen.getByRole('banner')).findByText(TV)
    ).toBeDefined()
  })

  it('says a wrong code is wrong, and pairs with the next one', async () => {
    const user = await openPairing()
    await pickTv(user)
    await enterCode(user, '111111')

    expect(
      await screen.findByText(t('pairByCode.code.wrong', { name: TV }))
    ).toBeDefined()
    await enterCode(user, FAKE_PAIRING_CODE)
    expect(
      await screen.findByRole('dialog', {
        name: t('pairByCode.done.title', { name: TV })
      })
    ).toBeDefined()
  })

  it('says how long to wait after too many wrong codes, and goes back to the list', async () => {
    const user = await openPairing('pairing-backoff')
    await pickTv(user)
    await enterCode(user, '111111')

    expect(
      await screen.findByText(
        t('pairByCode.backoff.wait', { name: TV, seconds: 30 })
      )
    ).toBeDefined()
    await user.click(
      screen.getByRole('button', { name: t('pairByCode.backToList') })
    )
    expect(
      await screen.findByRole('dialog', { name: t('pairByCode.title') })
    ).toBeDefined()
  })

  it('says the pairing screen closed, where to open it again, and goes back to the list', async () => {
    const user = await openPairing('pairing-screen-closed')
    await pickTv(user)

    const closed = await screen.findByRole('dialog', {
      name: t('pairByCode.closed.title', { name: TV })
    })
    expect(
      within(closed).getByText(t('pairByCode.closed.body', { name: TV }))
    ).toBeDefined()
    await user.click(
      within(closed).getByRole('button', { name: t('pairByCode.backToList') })
    )
    expect(
      await screen.findByRole('dialog', { name: t('pairByCode.title') })
    ).toBeDefined()
  })

  it('says when the OS refuses the search on the network', async () => {
    await openPairing('local-network-denied')
    const dialog = screen.getByRole('dialog', { name: t('pairByCode.title') })

    expect(
      await within(dialog).findByText(
        t('errors.device.local_network_denied.title')
      )
    ).toBeDefined()
  })

  it('opens from the device menu in the top bar', async () => {
    const user = userEvent.setup()
    await renderApp('/install')
    await user.click(
      await within(await screen.findByRole('banner')).findByRole('button', {
        name: new RegExp(t('topBar.device'))
      })
    )
    await user.click(
      await screen.findByRole('menuitem', { name: t('topBar.pairByCode') })
    )

    expect(
      await screen.findByRole('dialog', { name: t('pairByCode.title') })
    ).toBeDefined()
  })
})
