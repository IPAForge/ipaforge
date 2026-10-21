import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { t } from '@ui/__tests__/test-i18n.ts'
import { renderApp } from '@ui/__tests__/test-services.tsx'
import { tourStopKeys, tourStops } from '@ui/features/tour/constants.ts'
import { GuideKey } from '@ui/state/guide/constants.ts'

const stopDialog = (stop: (typeof tourStops)[number]) =>
  screen.findByRole('dialog', { name: t(tourStopKeys[stop].title) })

describe('tour', () => {
  it('starts when the guide is closed early, and goes through every stop to Done', async () => {
    const user = userEvent.setup()
    await renderApp('/install', { preferences: { [GuideKey.status]: 'open' } })
    await user.click(
      await screen.findByRole('button', { name: t('guide.welcome.skipGuide') })
    )

    for (const [index, stop] of tourStops.entries()) {
      const dialog = await stopDialog(stop)
      expect(dialog.textContent).toContain(
        t('tour.count', { current: index + 1, total: tourStops.length })
      )
      // Every stop has something on the page to point at.
      expect(document.querySelector(`[data-tour="${stop}"]`)).not.toBeNull()
      const isLast = index === tourStops.length - 1
      await user.click(
        screen.getByRole('button', {
          name: t(isLast ? 'tour.done' : 'tour.next')
        })
      )
    }
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })

  it('goes back a stop, and Escape closes it', async () => {
    const user = userEvent.setup()
    await renderApp('/settings')
    await user.click(
      await within(await screen.findByRole('main')).findByRole('button', {
        name: t('settings.guide.tour')
      })
    )
    await stopDialog('install')
    await user.click(screen.getByRole('button', { name: t('tour.next') }))
    await stopDialog('preload')
    await user.click(screen.getByRole('button', { name: t('tour.back') }))
    await stopDialog('install')

    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })

  it('starts from its button in the top bar', async () => {
    const user = userEvent.setup()
    await renderApp('/install')
    await user.click(
      await screen.findByRole('button', { name: t('topBar.tour') })
    )

    expect(await stopDialog('install')).toBeDefined()
  })

  it('starts on Finish later too', async () => {
    const user = userEvent.setup()
    await renderApp('/install', { preferences: { [GuideKey.status]: 'open' } })
    await user.click(
      await screen.findByRole('button', { name: t('guide.later') })
    )

    expect(await stopDialog('install')).toBeDefined()
  })
})
