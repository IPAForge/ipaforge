// What a sign-in and a sign-out do to an account's cached answers, seen on the Accounts page.
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { ErrorCode, LoadstarError } from '@loadstar/kernel'
import type { EngineClient } from '@loadstar/rpc'
import { t } from '@ui/__tests__/test-i18n.ts'
import { renderApp } from '@ui/__tests__/test-services.tsx'
import {
  EXPIRED_ACCOUNT,
  fakeAccounts,
  PERSONAL_TEAM
} from '@ui/services/engine/fake/fake-data.ts'
import { createFakeEngine } from '@ui/services/engine/fake/fake-engine.ts'
import { createFakeEngineClient } from '@ui/services/engine/fake/fake-engine-client.ts'
import type { Team } from '@ui/services/engine/types.ts'

const OLD = EXPIRED_ACCOUNT.appleId
const STUDIO = 'studio@example.com'

const rowFor = async (appleId: string) => {
  const list = await screen.findByRole('list', { name: t('accounts.list') })
  const row = within(list)
    .getAllByRole('listitem')
    .find((item) => item.textContent?.includes(appleId))
  if (!row) throw new Error(`no row for ${appleId}`)
  return row
}

/** OLD's session expired until it signs in again; then its teams answer waits for `release`. */
const reSignIn = () => {
  let expired = true
  let release = () => {}
  const held = new Promise<void>((resolve) => {
    release = resolve
  })
  const signInEngine = createFakeEngine({
    delayMs: 0,
    appleDelayMs: 0,
    scenario: 'sign-in-no-2fa'
  })
  const engine = createFakeEngineClient({
    delayMs: 0,
    overrides: {
      listAccounts: async () => [...fakeAccounts(), EXPIRED_ACCOUNT],
      listTeams: async (accountId): Promise<Team[]> => {
        if (accountId !== OLD) return [PERSONAL_TEAM]
        if (expired) throw new LoadstarError(ErrorCode.SessionExpired)
        await held
        return [PERSONAL_TEAM]
      },
      signIn: (input, options) => {
        expired = false
        return signInEngine.signIn(input, options)
      }
    }
  })

  return { engine, release: () => release() }
}

/** The fake Engine client with every call recorded, arguments included. */
const recording = (client: EngineClient) => {
  const calls: { method: string; args: unknown[] }[] = []
  const engine = Object.fromEntries(
    Object.entries(client).map(([method, call]) => [
      method,
      typeof call === 'function'
        ? (...args: unknown[]) => {
            calls.push({ method, args })
            return (call as (...args: unknown[]) => unknown)(...args)
          }
        : call
    ])
  ) as unknown as EngineClient

  return { engine, calls }
}

describe('the account cache', () => {
  it('shows "Checking…", not the old "Sign-in needed", right after signing in again, then the answer', async () => {
    const user = userEvent.setup()
    const { engine, release } = reSignIn()
    await renderApp('/accounts', { engine })
    const old = await rowFor(OLD)
    await waitFor(() =>
      expect(old.textContent).toContain(t('accounts.state.signInNeeded'))
    )

    await user.click(
      within(old).getByRole('button', { name: t('accounts.signInAgain') })
    )
    const form = await screen.findByRole('dialog', { name: t('signIn.title') })
    await user.type(within(form).getByLabelText(/Password/), 'secret')
    await user.click(
      within(form).getByRole('button', { name: t('signIn.submit') })
    )
    await screen.findByRole('dialog', { name: t('signIn.done.title') })

    await waitFor(async () =>
      expect((await rowFor(OLD)).textContent).toContain(
        t('accounts.state.checking')
      )
    )
    expect((await rowFor(OLD)).textContent).not.toContain(
      t('accounts.state.signInNeeded')
    )

    release()
    await waitFor(async () =>
      expect((await rowFor(OLD)).textContent).not.toContain(
        t('accounts.state.checking')
      )
    )
    expect((await rowFor(OLD)).textContent).toContain('Personal team')
  })

  it('asks the Engine nothing more about an Apple ID once it is signed out', async () => {
    const user = userEvent.setup()
    const { engine, calls } = recording(
      createFakeEngineClient({ delayMs: 0, appleDelayMs: 0 })
    )
    await renderApp('/accounts', { engine })
    const studio = await rowFor(STUDIO)
    await waitFor(() => expect(studio.textContent).toContain('Example Studio'))

    await user.click(
      within(studio).getByRole('button', {
        name: t('accounts.signOut.action')
      })
    )
    const confirm = await screen.findByRole('alertdialog')
    await user.click(
      within(confirm).getByRole('button', {
        name: t('accounts.signOut.confirm')
      })
    )
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    const signedOutAt = calls.findIndex((call) => call.method === 'signOut')
    await new Promise((resolve) => setTimeout(resolve, 100))

    expect(signedOutAt).toBeGreaterThanOrEqual(0)
    const later = calls
      .slice(signedOutAt + 1)
      .filter((call) => JSON.stringify(call.args).includes(STUDIO))
    expect(later).toEqual([])
    expect(screen.getByRole('main').textContent).not.toContain(STUDIO)
  })
})
