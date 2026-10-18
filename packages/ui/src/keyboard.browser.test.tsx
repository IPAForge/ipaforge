// The app from the keyboard alone, in a real browser: the skip link shows when focused, Tab walks the top bar
// and the sidebar in order with a visible focus ring, a picker opens and closes without a mouse, and Ctrl+L
// opens Logs.
import { describe, expect, it } from 'vitest'
import { page, userEvent } from 'vitest/browser'

import { renderScreen } from '@ui/__tests__/screens.ts'
import { t } from '@ui/__tests__/test-i18n.ts'
import { sections } from '@ui/sections.ts'

const focused = () => document.activeElement as HTMLElement | null

/** A focus ring drawn as an outline or as a ring (box shadow). */
const showsFocus = (element: HTMLElement) => {
  const style = getComputedStyle(element)

  return style.outlineStyle !== 'none' || style.boxShadow !== 'none'
}

describe('the keyboard', () => {
  it('shows the skip link on the first Tab, and it moves focus to the page', async () => {
    await renderScreen('/devices')

    await userEvent.tab()
    const skip = focused()
    expect(skip?.textContent).toBe(t('shell.skipToContent'))
    expect(skip?.getBoundingClientRect().width).toBeGreaterThan(2)
    await expect(page.elementLocator(document.body)).toMatchScreenshot(
      'skip-link-focused'
    )

    await userEvent.keyboard('{Enter}')
    expect(focused()?.tagName).toBe('MAIN')
  })

  it('walks the top bar pickers, then every section in order, each with a focus ring', async () => {
    await renderScreen('/devices')

    await userEvent.tab()
    for (const labelKey of ['topBar.device', 'topBar.account'] as const) {
      await userEvent.tab()
      expect(focused()?.textContent).toContain(t(labelKey))
    }
    for (const section of sections) {
      await userEvent.tab()
      const link = focused()
      expect(link?.textContent).toBe(t(section.labelKey))
      expect(showsFocus(link as HTMLElement)).toBe(true)
    }
  })

  it('opens the device picker with Enter and closes it with Escape, back on its button', async () => {
    await renderScreen('/devices')
    await userEvent.tab()
    await userEvent.tab()
    const picker = focused()

    await userEvent.keyboard('{Enter}')
    await expect.element(page.getByRole('menu')).toBeVisible()
    await userEvent.keyboard('{Escape}')
    await expect.element(page.getByRole('menu')).not.toBeInTheDocument()
    expect(focused()).toBe(picker)
  })

  it('opens Logs with Ctrl+L', async () => {
    const { history } = await renderScreen('/devices')

    await userEvent.keyboard('{Control>}l{/Control}')
    await expect.poll(() => history.location.pathname).toBe('/logs')
  })
})
