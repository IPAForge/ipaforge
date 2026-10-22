import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { t } from '@ui/__tests__/test-i18n.ts'
import { renderApp } from '@ui/__tests__/test-services.tsx'
import { LOCAL_NETWORK_SETTINGS_URL } from '@ui/features/devices/constants.ts'

describe('Local network notice', () => {
  it('says on the Devices page when macOS refuses the search on Wi-Fi, and opens its settings', async () => {
    const user = userEvent.setup()
    const { links } = await renderApp('/devices', {
      scenario: 'local-network-denied'
    })
    const notice = (
      await screen.findByText(t('errors.device.local_network_denied.title'))
    ).closest('[role="status"]') as HTMLElement
    expect(notice.textContent).toContain(
      t('recovery.fix.allowLocalNetwork.how')
    )

    await user.click(
      within(notice).getByRole('button', {
        name: t('devices.localNetwork.open')
      })
    )
    expect(links.opened).toEqual([LOCAL_NETWORK_SETTINGS_URL])
  })

  it('stays away while the search is allowed', async () => {
    await renderApp('/devices')
    await screen.findByRole('heading', { level: 1, name: t('nav.devices') })
    expect(
      screen.queryByText(t('errors.device.local_network_denied.title'))
    ).toBeNull()
  })
})
