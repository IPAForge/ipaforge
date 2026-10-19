// The on-device checklist on the Devices page, and its line on Install: folded into "set up" when everything is
// done, open with the steps when not, and the steps you ticked shown as done.
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { t } from '@ui/__tests__/test-i18n.ts'
import { renderApp } from '@ui/__tests__/test-services.tsx'
import { checklistKey } from '@ui/features/devices/checklist/constants.ts'
import { FAKE_IPHONE } from '@ui/services/engine/fake/fake-data.ts'

/** The fake iPhone with the steps only you can see ticked: everything done. */
const TICKED = {
  [checklistKey(FAKE_IPHONE)]: JSON.stringify(['passcode', 'developer'])
}

describe('the on-device checklist', () => {
  it('folds into one line when the iPhone is set up, and opens on Show checklist', async () => {
    const user = userEvent.setup()

    await renderApp('/devices', { preferences: TICKED })
    await user.click(
      await screen.findByRole('button', { name: t('checklist.show') })
    )

    expect(
      await screen.findByRole('list', { name: t('checklist.group.before') })
    ).toBeDefined()
  })

  it('leaves the steps only you can see unticked until you tick them', async () => {
    await renderApp('/devices')

    const before = await screen.findByRole('list', {
      name: t('checklist.group.before')
    })

    expect(within(before).getByText(t('checklist.onPhone'))).toBeDefined()
  })

  it('shows what is left, with LocalDevVPN to install', async () => {
    await renderApp('/devices', { scenario: 'checklist-todo' })

    const sideStore = await screen.findByRole('list', {
      name: t('checklist.group.sidestore')
    })

    expect(
      within(sideStore).getByText(t('checklist.vpn.notInstalled'))
    ).toBeDefined()
    expect(
      within(sideStore).getByRole('img', { name: t('checklist.vpn.qrLabel') })
    ).toBeDefined()
  })

  it('says on Install how many things are left on the device', async () => {
    await renderApp('/install', { scenario: 'checklist-todo' })

    expect(
      await screen.findByRole('button', { name: t('checklist.showChecklist') })
    ).toBeDefined()
  })

  it('marks a step you ticked as done on the iPhone', async () => {
    const user = userEvent.setup()

    await renderApp('/devices', { scenario: 'checklist-todo' })

    const before = await screen.findByRole('list', {
      name: t('checklist.group.before')
    })
    const [tick] = within(before).getAllByRole('checkbox', {
      name: t('checklist.tick')
    })

    if (!tick) throw new Error('no box to tick')
    await user.click(tick)

    expect(
      await within(before).findByText(t('checklist.tickedTag'))
    ).toBeDefined()
  })
})
