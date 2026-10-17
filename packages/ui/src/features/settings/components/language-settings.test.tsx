import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { createControllableLoad } from '@ui/__tests__/controllable-load.ts'
import { createTestI18n, t } from '@ui/__tests__/test-i18n.ts'
import { renderApp } from '@ui/__tests__/test-services.tsx'
import { LANGUAGE_PREFERENCE_KEY } from '@ui/i18n/languages/language-store.ts'

const html = () => document.documentElement
/** The select is named by its value and the card title, which is in the language shown. */
const languageSelect = (title = t('settings.language.title')) =>
  screen.findByRole('button', { name: new RegExp(title) })
const heading = (name: string) =>
  screen.findByRole('heading', { level: 1, name })

const openLanguages = async (
  user: ReturnType<typeof userEvent.setup>,
  title?: string
) => {
  await user.click(await languageSelect(title))
  return within(await screen.findByRole('listbox'))
}

describe('Language settings', () => {
  it('shows the detected system language and the hint', async () => {
    await renderApp('/settings', { languages: ['de-AT'] })
    const german = await createTestI18n('de')
    expect(
      (await languageSelect(german.t('settings.language.title'))).textContent
    ).toContain(german.t('settings.language.system', { language: 'Deutsch' }))
    expect(screen.getByText(german.t('settings.language.hint'))).toBeDefined()
    expect(html().getAttribute('lang')).toBe('de')
  })

  it('lists System plus every language in its own name, drafts labelled', async () => {
    const user = userEvent.setup()
    await renderApp('/settings')
    const list = await openLanguages(user)
    const options = list
      .getAllByRole('option')
      .map((option) => option.textContent)

    expect(options).toEqual([
      t('settings.language.system', { language: 'English' }),
      'English',
      `Deutsch${t('settings.language.draft')}`,
      `Română${t('settings.language.draft')}`,
      `Русский${t('settings.language.draft')}`,
      `العربية${t('settings.language.draft')}`,
      `日本語${t('settings.language.draft')}`,
      expect.stringContaining('English (') // the dev-only pseudo-locale
    ])
  })

  it('switches the language live, mirrors for Arabic, and persists the choice', async () => {
    const user = userEvent.setup()
    const { services, records } = await renderApp('/settings')
    await heading(t('nav.settings'))

    await user.click(
      (await openLanguages(user)).getByRole('option', { name: /العربية/ })
    )

    await heading((await createTestI18n('ar')).t('nav.settings'))
    expect([html().getAttribute('lang'), html().getAttribute('dir')]).toEqual([
      'ar',
      'rtl'
    ])
    expect(services.preferences.read(LANGUAGE_PREFERENCE_KEY)).toBe('ar')
    expect(records).toContainEqual(
      expect.objectContaining({
        level: 'info',
        scope: 'ui.i18n',
        msg: 'language changed',
        fields: { locale: 'ar' }
      })
    )

    const arabic = await createTestI18n('ar')
    const arabicSystem = arabic.t('settings.language.system', {
      language: 'English'
    })
    await user.click(
      (
        await openLanguages(user, arabic.t('settings.language.title'))
      ).getByRole('option', { name: arabicSystem })
    )
    await heading(t('nav.settings'))
    await waitFor(() => expect(html().getAttribute('dir')).toBe('ltr'))
    expect(services.preferences.read(LANGUAGE_PREFERENCE_KEY)).toBe('system')
  })

  it('renders a saved non-English language from the first render, never English', async () => {
    const texts: string[] = []
    const observer = new MutationObserver(() =>
      texts.push(document.body.textContent ?? '')
    )
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true
    })

    await renderApp('/settings', {
      languages: ['en-US'],
      preferences: { [LANGUAGE_PREFERENCE_KEY]: 'ja' }
    })
    const japanese = await createTestI18n('ja')
    await heading(japanese.t('nav.settings'))
    observer.disconnect()

    expect(html().getAttribute('lang')).toBe('ja')
    expect(
      texts.filter((text) => text.includes(t('shell.skipToContent')))
    ).toEqual([])
    expect(
      texts.some((text) => text.includes(japanese.t('shell.skipToContent')))
    ).toBe(true)
  })

  it("keeps the current language, and the select's value, until the new bundle has loaded", async () => {
    const user = userEvent.setup()
    const control = createControllableLoad(['ar'])
    await renderApp('/settings', { load: control.load })
    await user.click(
      (await openLanguages(user)).getByRole('option', { name: /العربية/ })
    )

    expect((await languageSelect()).textContent).toContain(
      t('settings.language.system', { language: 'English' })
    )
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(
      t('nav.settings')
    )
    expect(html().getAttribute('lang')).toBe('en')

    control.release('ar')
    await heading((await createTestI18n('ar')).t('nav.settings'))
    expect(html().getAttribute('dir')).toBe('rtl')
  })

  it('stays on the current language when the bundle fails to load', async () => {
    const user = userEvent.setup()
    const control = createControllableLoad(['ru'])
    const { services, records } = await renderApp('/settings', {
      load: control.load
    })
    control.fail('ru')
    await user.click(
      (await openLanguages(user)).getByRole('option', { name: /Русский/ })
    )

    await waitFor(() =>
      expect(records).toContainEqual(
        expect.objectContaining({
          level: 'warn',
          msg: 'language bundle failed to load'
        })
      )
    )
    expect((await languageSelect()).textContent).toContain(
      t('settings.language.system', { language: 'English' })
    )
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(
      t('nav.settings')
    )
    expect(html().getAttribute('lang')).toBe('en')
    expect(services.preferences.read(LANGUAGE_PREFERENCE_KEY)).toBeUndefined()
  })
})
