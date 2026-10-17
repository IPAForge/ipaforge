// The state shown for an Apple ID: never "ready" before Apple answered, "sign-in needed" kept as a known answer
// (no refetch when a menu opens or the window gets focus), and said in words in the top bar and on Install.
import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { ErrorCode, LoadstarError } from '@loadstar/kernel'
import { t } from '@ui/__tests__/test-i18n.ts'
import {
  renderApp,
  type TestServicesOptions
} from '@ui/__tests__/test-services.tsx'
import {
  EXPIRED_ACCOUNT,
  fakeAccounts,
  PERSONAL_TEAM
} from '@ui/services/engine/fake/fake-data.ts'
import { createFakeEngineClient } from '@ui/services/engine/fake/fake-engine-client.ts'
import type { Team } from '@ui/services/engine/types.ts'
import { selectionKeys } from '@ui/state/selection/constants.ts'

const OLD = EXPIRED_ACCOUNT.appleId
const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/** A fake Engine whose teams answers the test controls and counts. */
const countingTeams = (listTeams: (accountId: string) => Promise<Team[]>) => {
  const spy = vi.fn(listTeams)
  const engine = createFakeEngineClient({
    delayMs: 0,
    overrides: {
      listAccounts: async () => [...fakeAccounts(), EXPIRED_ACCOUNT],
      listTeams: spy
    }
  })

  return { engine, listTeams: spy }
}

const expiredFor =
  (expired: string) =>
  async (accountId: string): Promise<Team[]> => {
    if (accountId === expired) throw new LoadstarError(ErrorCode.SessionExpired)
    return [PERSONAL_TEAM]
  }

const accountButton = async (appleId: string) =>
  within(await screen.findByRole('banner')).findByRole('button', {
    name: new RegExp(appleId.replace('.', '\\.'))
  })

const dotTone = (button: HTMLElement) =>
  button.querySelector('[data-tone]')?.getAttribute('data-tone')

const render = (options: TestServicesOptions) =>
  renderApp('/install', {
    preferences: { [selectionKeys.account]: OLD },
    ...options
  })

describe('an Apple ID whose session expired', () => {
  it('says so in words next to the top bar Apple ID, in the warning tone', async () => {
    const { engine } = countingTeams(expiredFor(OLD))
    await render({ engine })
    const button = await accountButton(OLD)
    await waitFor(() =>
      expect(button.textContent).toContain(t('accounts.state.signInNeeded'))
    )
    expect(dotTone(button)).toBe('warning')
  })

  it('keeps that answer: opening and closing the picker or a focus event asks Apple nothing and changes nothing', async () => {
    const user = userEvent.setup()
    const { engine, listTeams } = countingTeams(expiredFor(OLD))
    await render({ engine })
    const button = await accountButton(OLD)
    await waitFor(() => expect(dotTone(button)).toBe('warning'))
    const callsFor = () =>
      listTeams.mock.calls.filter(([id]) => id === OLD).length
    const before = callsFor()

    await user.click(button)
    await screen.findByRole('menu')
    expect(dotTone(button)).toBe('warning')
    await user.keyboard('{Escape}')
    act(() => {
      window.dispatchEvent(new Event('focus'))
    })
    await pause(100)

    expect(callsFor()).toBe(before)
    expect(dotTone(button)).toBe('warning')
  })

  it('shows "Checking…", not ready, until Apple has answered', async () => {
    const user = userEvent.setup()
    const { engine } = countingTeams(() => new Promise<Team[]>(() => {}))
    await render({ engine })
    const button = await accountButton(OLD)
    expect(dotTone(button)).toBe('off')

    await user.click(button)
    const menu = await screen.findByRole('menu')
    expect(menu.textContent).toContain(t('accounts.state.checking'))
  })

  it('warns on Install, and becomes ready after signing in again from there', async () => {
    const user = userEvent.setup()
    await render({ scenario: 'accounts' })
    expect(
      await screen.findByText(t('install.signInNeeded.title'))
    ).toBeDefined()

    await user.click(
      within(screen.getByRole('main')).getByRole('button', {
        name: t('accounts.signInAgain')
      })
    )
    const form = await screen.findByRole('dialog', { name: t('signIn.title') })
    expect(
      (within(form).getByLabelText(/Apple ID/) as HTMLInputElement).value
    ).toBe(OLD)
    await user.type(within(form).getByLabelText(/Password/), 'secret')
    await user.click(
      within(form).getByRole('button', { name: t('signIn.submit') })
    )
    const method = await screen.findByRole('dialog', {
      name: t('prompts.method.title')
    })
    await user.click(
      within(method).getByRole('button', {
        name: new RegExp(t('prompts.method.trustedDevice'))
      })
    )
    const code = await screen.findByRole('dialog', {
      name: t('prompts.code.title')
    })
    await user.type(within(code).getByRole('textbox'), '123456')
    await user.click(
      within(code).getByRole('button', { name: t('prompts.code.verify') })
    )
    const done = await screen.findByRole('dialog', {
      name: t('signIn.done.title')
    })
    await user.click(
      within(done).getByRole('button', { name: t('signIn.done.close') })
    )

    await waitFor(() =>
      expect(screen.queryByText(t('install.signInNeeded.title'))).toBeNull()
    )
    const button = await accountButton(OLD)
    await waitFor(() => expect(dotTone(button)).toBe('ready'))
    expect(button.textContent).not.toContain(t('accounts.state.signInNeeded'))
  })
})
