// Pairing files from the Apps page, against the fake Engine: the tag on an app without one opens the dialog at it,
// Place gives it one, an app of your own asks where (a wrong path is refused), Remove asks first, a new remote
// pairing asks first, and the Devices page saves the device's pairing file.
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { t } from '@ui/__tests__/test-i18n.ts'
import { renderApp } from '@ui/__tests__/test-services.tsx'
import { DEFAULT_PAIRING_PATH } from '@ui/features/apps/constants.ts'
import { AutoRefreshKey } from '@ui/state/auto-refresh/constants.ts'

const LIVECONTAINER = 'LiveContainer - BETA NOT MEANT FOR USE YET'
const AUTO_OFF = { [AutoRefreshKey.isOn]: 'false' }

const openApps = async () => {
  const user = userEvent.setup()

  await renderApp('/apps', { preferences: AUTO_OFF })
  await screen.findByRole('list', { name: t('apps.list.title') })

  return user
}

const pairingList = () =>
  screen.findByRole('list', { name: t('apps.pairing.title') })

const pairingRow = async (name: string) =>
  waitFor(async () => {
    const row = within(await pairingList())
      .getAllByRole('listitem')
      .find((item) => item.textContent?.startsWith(name))

    if (!row) throw new Error(`no pairing row for ${name}`)

    return row
  })

describe('pairing files', () => {
  it('opens at an app that has none from its tag, and places one there', async () => {
    const user = await openApps()

    await user.click(
      await screen.findByRole('button', {
        name: t('apps.pairing.tagOne', { name: LIVECONTAINER })
      })
    )
    const row = await pairingRow(LIVECONTAINER)
    expect(row.textContent).toContain(t('apps.pairing.classic.missing'))

    await user.click(
      within(row).getByRole('button', {
        name: t('apps.pairing.placeOne', { name: LIVECONTAINER })
      })
    )

    await waitFor(async () =>
      expect((await pairingRow(LIVECONTAINER)).textContent).toContain(
        t('apps.pairing.classic.thisComputer')
      )
    )
    await user.click(
      screen.getByRole('button', { name: t('apps.pairing.done') })
    )
    await waitFor(() =>
      expect(
        screen.queryByRole('button', {
          name: t('apps.pairing.tagOne', { name: LIVECONTAINER })
        })
      ).toBeNull()
    )
  })

  it('asks where in your own app the file goes, and refuses a path outside Documents and Library', async () => {
    const user = await openApps()

    await user.click(
      screen.getByRole('button', { name: t('apps.pairing.open') })
    )
    await user.click(
      within(await pairingRow('MyGame')).getByRole('button', {
        name: t('apps.pairing.addOne', { name: 'MyGame' })
      })
    )
    const path = await screen.findByRole('textbox', {
      name: t('apps.pairing.pathLabel')
    })
    expect((path as HTMLInputElement).value).toBe(DEFAULT_PAIRING_PATH)

    await user.clear(path)
    await user.type(path, 'tmp/pairing.plist')
    await user.click(
      screen.getByRole('button', { name: t('apps.pairing.place') })
    )
    expect(await screen.findByText(t('apps.pairing.pathInvalid'))).toBeTruthy()

    await user.clear(path)
    await user.type(path, 'Documents/Game/pairing.plist')
    await user.click(
      screen.getByRole('button', { name: t('apps.pairing.place') })
    )

    await waitFor(async () =>
      expect((await pairingRow('MyGame')).textContent).toContain(
        'Documents/Game/pairing.plist'
      )
    )
  })

  it('removes a pairing file after asking, and makes a new remote pairing after asking', async () => {
    const user = await openApps()

    await user.click(
      screen.getByRole('button', { name: t('apps.pairing.open') })
    )
    await user.click(
      within(await pairingRow('YouTube')).getByRole('button', {
        name: t('apps.pairing.removeOne', { name: 'YouTube' })
      })
    )
    await user.click(
      await screen.findByRole('button', { name: t('apps.pairing.remove') })
    )
    await waitFor(async () =>
      expect(
        within(await pairingRow('YouTube')).getByRole('button', {
          name: t('apps.pairing.addOne', { name: 'YouTube' })
        })
      ).toBeTruthy()
    )

    await user.click(
      screen.getByRole('button', { name: t('apps.pairing.newRemote') })
    )
    expect(
      await screen.findByText(t('apps.pairing.newRemoteBody'))
    ).toBeTruthy()
    await user.click(
      screen.getByRole('button', { name: t('apps.pairing.newRemoteConfirm') })
    )
    expect(await pairingList()).toBeTruthy()
  })

  it('saves the device’s pairing file from the Devices page', async () => {
    const user = userEvent.setup()
    const { files } = await renderApp('/devices', { preferences: AUTO_OFF })

    await user.click(
      await screen.findByRole('button', { name: t('devices.savePairing') })
    )

    await waitFor(() => expect(files.saved).toHaveLength(1))
    expect(files.saved[0]?.name).toMatch(/\.mobiledevicepairing$/)
    expect(files.saved[0]?.text).toContain('<plist')
  })
})
