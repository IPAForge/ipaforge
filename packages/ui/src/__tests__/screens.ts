// Screens for the browser tests: the whole app in a language and colour mode, the signals that a screen has
// settled (language-neutral, so one check serves every locale), and the checks run on what it shows.
import { waitFor } from '@testing-library/react'
import axe from 'axe-core'
import { expect } from 'vitest'

import { compact } from '@ipaforge/kernel'
import { renderApp } from '@ui/__tests__/test-services.tsx'
import type { LanguageId } from '@ui/i18n/languages/types.ts'
import type { FakeScenarioId } from '@ui/services/engine/fake/types.ts'

export type ScreenOptions = {
  readonly language?: LanguageId
  readonly mode?: 'light' | 'dark'
  readonly scenario?: FakeScenarioId
}

const all = (selector: string) => document.querySelectorAll(selector)

/** The app at `path`, in `language` and `mode`, once the top bar has read the device and the Apple ID. */
export const renderScreen = async (
  path: string,
  { language = 'en', mode = 'light', scenario }: ScreenOptions = {}
) => {
  const rendered = await renderApp(
    path,
    compact({
      scenario,
      preferences: { language, 'theme.mode': mode }
    })
  )
  await waitFor(() =>
    expect(all('header [data-tone="ready"]').length).toBeGreaterThanOrEqual(2)
  )
  return rendered
}

/** The Install page has the Engine's plan (App IDs, free apps, certificate, team). */
export const planShown = () =>
  waitFor(() => expect(all('main dl dd').length).toBeGreaterThanOrEqual(4))

/** Presses Install, the page's primary button, once it can be pressed. */
export const pressInstall = async () => {
  const install = await waitFor(() => {
    const button = document.querySelector(
      'main .button--primary:not([disabled])'
    )
    if (!(button instanceof HTMLElement)) throw new Error('no Install yet')
    return button
  })
  install.click()
}

/** Fills the Preload list (StikDebug from the catalog, a chosen file) and waits until both are read. */
export const fillPreload = async () => {
  const add = await waitFor(() => {
    const button = document.querySelector('main article button')
    if (!(button instanceof HTMLElement)) throw new Error('no catalog yet')
    return button
  })
  add.click()
  // Choose files…, the drop zone's first button, the first in the Add apps tab.
  const choose = document.querySelector('main [role="tabpanel"] button')
  if (choose instanceof HTMLElement) choose.click()
  await waitFor(() => {
    expect(all('main ul li')).toHaveLength(2)
    expect(all('main .button--primary:not([disabled])')).toHaveLength(1)
  })
}

/** The Apps page with its installed apps and the apps of other tools. */
export const appsShown = () =>
  waitFor(() => expect(all('main ul li').length).toBeGreaterThanOrEqual(4))

/** Repair SideStore with every result in (they come one by one), and the two to check on the iPhone. */
export const repairShown = () =>
  waitFor(
    () => {
      expect(all('main ul li').length).toBeGreaterThanOrEqual(9)
      expect(all('main [data-checking]')).toHaveLength(0)
    },
    { timeout: 5000 }
  )

/** Preload's Sources tab, with the built-in sources listed. */
export const showSources = async () => {
  const tab = await waitFor(() => {
    const found = all('main [role="tab"]')[1]

    if (!(found instanceof HTMLElement)) throw new Error('no tabs yet')
    return found
  })

  tab.click()
  await waitFor(() => expect(all('main ul li')).toHaveLength(2))
}

/** The box a piece of text has to stay inside: its card, row, dialog, notice or page region. */
const BOXES =
  'article, li, [role="dialog"], [role="alertdialog"], [role="alert"], header, nav, main'

/** Text that runs out of its box (a long word, name or link that didn't wrap), by its words. */
export const textOutsideItsBox = (): string[] =>
  [...document.body.querySelectorAll<HTMLElement>('*')]
    .filter((element) => ownText(element).trim() !== '')
    .filter((element) => {
      const box = element.parentElement?.closest(BOXES)
      if (!box || isVisuallyHidden(element)) return false

      const inner = element.getBoundingClientRect()
      const outer = box.getBoundingClientRect()

      return inner.left < outer.left - 1 || inner.right > outer.right + 1
    })
    .map((element) => ownText(element).trim())

/** A failed run's recovery box, with its fixes. */
export const recoveryShown = () =>
  waitFor(() => expect(all('[role="alert"] button').length).toBeGreaterThan(2))

/** The Logs page has the fake Engine's lines and the debug switch. */
export const logsShown = () =>
  waitFor(() => {
    expect(all('[role="log"] button[aria-expanded]')).toHaveLength(3)
    expect(all('input[role="switch"]:not([disabled])')).toHaveLength(1)
  })

const ownText = (element: Element) =>
  [...element.childNodes]
    .filter((node) => node.nodeType === Node.TEXT_NODE)
    .map((node) => node.textContent ?? '')
    .join('')

/** Hidden until focused or for screen readers only (the skip link, `sr-only`): clipped to nothing on purpose. */
const isVisuallyHidden = (element: HTMLElement) => {
  const style = getComputedStyle(element)
  const { width, height } = element.getBoundingClientRect()

  return (
    width < 2 ||
    height < 2 ||
    style.clip === 'rect(0px, 0px, 0px, 0px)' ||
    style.clipPath === 'inset(50%)'
  )
}

const isClipped = (element: HTMLElement) => {
  if (isVisuallyHidden(element)) return false
  const style = getComputedStyle(element)
  const hides =
    style.overflowX !== 'visible' || style.textOverflow === 'ellipsis'

  return hides && element.scrollWidth > element.clientWidth + 1
}

/**
 * Translated text that doesn't fit: the pseudo-locale wraps every message in brackets, so a clipped bracket is a
 * label too short for a longer language. User data (names, Apple IDs) has no brackets and may truncate by design.
 */
export const clippedTranslations = (): string[] =>
  [...document.body.querySelectorAll<HTMLElement>('*')]
    .filter((element) => ownText(element).includes('[') && isClipped(element))
    .map((element) => ownText(element).trim())

const WCAG_AA = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']

/** WCAG 2.2 AA violations axe finds on the page, one line each: the rule and where. */
export const accessibilityViolations = async (): Promise<string[]> => {
  const { violations } = await axe.run(document, {
    runOnly: { type: 'tag', values: WCAG_AA }
  })

  return violations.flatMap((violation) =>
    violation.nodes.map(
      (node) =>
        `${violation.id}: ${node.target.join(' ')} (${node.failureSummary ?? ''})`
    )
  )
}
