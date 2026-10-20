// "Add Apple ID" from the top bar, against the fake Engine over the rpc memory transport.
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { t } from '@ui/__tests__/test-i18n.ts'
import { renderApp } from '@ui/__tests__/test-services.tsx'
import { createFakeEngine } from '@ui/services/engine/fake/fake-engine.ts'
import { createFakeEngineClient } from '@ui/services/engine/fake/fake-engine-client.ts'
import type { FakeScenarioId } from '@ui/services/engine/fake/types.ts'

const NEW_ID = 'new@example.com'
type User = ReturnType<typeof userEvent.setup>

const accountButton = (appleId: string) =>
  within(screen.getByRole('banner')).findByRole('button', {
    name: `${t('topBar.account')} ${appleId}`
  })

const openSignIn = async (
  scenario: FakeScenarioId = 'happy',
  appleAnswer?: () => Promise<void>
) => {
  const user = userEvent.setup()
  await renderApp(
    '/install',
    appleAnswer ? { scenario, appleAnswer } : { scenario }
  )
  await screen.findByRole('banner')
  await user.click(await accountButton('work@example.com'))
  await user.click(
    await screen.findByRole('menuitem', { name: t('topBar.addAppleId') })
  )
  await screen.findByRole('dialog', { name: t('signIn.title') })
  return user
}

const submitForm = async (user: User, password = 'secret') => {
  const dialog = screen.getByRole('dialog', { name: t('signIn.title') })
  const appleId = within(dialog).getByLabelText(/Apple ID/)
  if (!(appleId as HTMLInputElement).value) await user.type(appleId, NEW_ID)
  await user.type(within(dialog).getByLabelText(/Password/), password)
  await user.click(
    within(dialog).getByRole('button', { name: t('signIn.submit') })
  )
}

const enterCode = async (user: User, code: string) => {
  const dialog = await screen.findByRole('dialog', {
    name: t('prompts.code.title')
  })
  await user.type(within(dialog).getByRole('textbox'), code)
  await user.click(
    within(dialog).getByRole('button', { name: t('prompts.code.verify') })
  )
}

/** Checks the "Signed in as …" step, closes it, and returns the Apple ID the top bar then shows. */
const closeSignedIn = async (user: User): Promise<string | null> => {
  const done = await screen.findByRole('dialog', {
    name: t('signIn.done.title')
  })
  expect(
    within(done).getByText(t('signIn.done.body', { appleId: NEW_ID }))
  ).toBeDefined()
  await user.click(
    within(done).getByRole('button', { name: t('signIn.done.close') })
  )
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())

  return (await accountButton(NEW_ID)).textContent
}

const TEXT_INSTEAD = /••42/

/** Asks for the code by text message instead, from the code step. */
const textInstead = async (user: User) => {
  const dialog = await screen.findByRole('dialog', {
    name: t('prompts.code.title')
  })
  await user.click(within(dialog).getByRole('button', { name: TEXT_INSTEAD }))
}

describe('Add Apple ID', () => {
  it('signs in with a trusted-device code, says who is signed in, and shows it in the top bar', async () => {
    const user = await openSignIn()
    await submitForm(user)
    const code = await screen.findByRole('dialog', {
      name: t('prompts.code.title')
    })
    expect(code.textContent).toContain(
      t('prompts.code.deviceBody', { length: 6 })
    )
    await enterCode(user, '123456')
    expect(await closeSignedIn(user)).toContain(NEW_ID)
  })

  it('signs in with a code sent by text message instead', async () => {
    const user = await openSignIn()
    await submitForm(user)
    await textInstead(user)
    const sent = await screen.findByRole('status')
    expect(sent.textContent).toBe(t('prompts.code.sent'))
    await enterCode(user, '123456')
    expect(await closeSignedIn(user)).toContain(NEW_ID)
  })

  it('asks for the code again after a wrong one, saying so', async () => {
    const user = await openSignIn()
    await submitForm(user)
    await enterCode(user, '000000')
    const again = await screen.findByRole('dialog', {
      name: t('prompts.code.title')
    })
    expect(within(again).getByRole('alert').textContent).toBe(
      t('prompts.code.wrong')
    )
    await enterCode(user, '123456')
    expect(await closeSignedIn(user)).toContain(NEW_ID)
  })

  it('signs in without a second factor when Apple does not ask for one', async () => {
    const user = await openSignIn('sign-in-no-2fa')
    await submitForm(user)
    expect(await closeSignedIn(user)).toContain(NEW_ID)
  })

  it('shows wrong credentials in their translated words and keeps the Apple ID', async () => {
    const user = await openSignIn('wrong-password')
    await submitForm(user, 'nope')

    const dialog = await screen.findByRole('dialog', {
      name: t('signIn.title')
    })
    expect(
      await within(dialog).findByText(
        t('errors.apple.invalid_credentials.title')
      )
    ).toBeDefined()
    expect(
      (within(dialog).getByLabelText(/Apple ID/) as HTMLInputElement).value
    ).toBe(NEW_ID)
    await waitFor(() =>
      expect(
        (within(dialog).getByLabelText(/Password/) as HTMLInputElement).value
      ).toBe('')
    )
  })

  it('goes back to the form when the second factor is cancelled, and closes on Cancel', async () => {
    const user = await openSignIn()
    await submitForm(user)
    const code = await screen.findByRole('dialog', {
      name: t('prompts.code.title')
    })
    await user.click(
      within(code).getByRole('button', { name: t('prompts.cancel') })
    )
    const form = await screen.findByRole('dialog', { name: t('signIn.title') })
    expect(within(form).queryByRole('alert')).toBeNull()

    await user.click(
      within(form).getByRole('button', { name: t('prompts.cancel') })
    )
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(await accountButton('work@example.com')).toBeDefined()
  })
})

/** Holds each of Apple's answers until the test releases it. */
const holdApple = () => {
  const held: (() => void)[] = []
  const appleAnswer = () =>
    new Promise<void>((resolve) => {
      held.push(resolve)
    })
  const release = async () => {
    await vi.waitFor(() => expect(held.length).toBeGreaterThan(0))
    held.shift()?.()
  }

  return { appleAnswer, release }
}

/**
 * Records whether the Apple ID/password form is ever on screen from now on. It first waits for the form that was
 * just replaced to finish leaving (its closing animation keeps it in the page a moment on a slow machine).
 */
const watchForForm = async () => {
  await waitFor(() =>
    expect(
      screen.queryByRole('heading', { name: t('signIn.title') })
    ).toBeNull()
  )
  let seen = false
  const check = () => {
    if (screen.queryByRole('heading', { name: t('signIn.title') })) seen = true
  }
  const observer = new MutationObserver(check)
  observer.observe(document.body, { childList: true, subtree: true })

  return {
    wasSeen: () => {
      check()
      observer.disconnect()
      return seen
    }
  }
}

const isPending = (button: HTMLElement) => button.hasAttribute('data-pending')

describe('Add Apple ID, while Apple answers', () => {
  it('keeps the form, read-only with Sign in busy, until Apple has checked the password', async () => {
    const apple = holdApple()
    const user = await openSignIn('happy', apple.appleAnswer)
    await submitForm(user)

    const form = screen.getByRole('dialog', { name: t('signIn.title') })
    expect(
      isPending(within(form).getByRole('button', { name: t('signIn.submit') }))
    ).toBe(true)
    expect(
      within(form)
        .getByLabelText(/Apple ID/)
        .hasAttribute('readonly')
    ).toBe(true)
    expect(within(form).getByText(t('signIn.signingIn'))).toBeDefined()

    // Apple checks the password, then sends the code.
    await apple.release()
    await apple.release()
    expect(
      await screen.findByRole('dialog', { name: t('prompts.code.title') })
    ).toBeDefined()
  })

  it('keeps the code step busy while a new code is sent, then says it was', async () => {
    const apple = holdApple()
    const user = await openSignIn('happy', apple.appleAnswer)
    await submitForm(user)
    await apple.release()
    await apple.release()
    const form = await watchForForm()
    const code = await screen.findByRole('dialog', {
      name: t('prompts.code.title')
    })
    await user.click(
      within(code).getByRole('button', { name: t('prompts.code.resend') })
    )

    expect(within(code).getByText(t('prompts.code.sending'))).toBeDefined()
    expect(
      within(code)
        .getByRole('button', { name: t('prompts.code.resend') })
        .hasAttribute('disabled')
    ).toBe(true)

    await apple.release()
    expect((await screen.findByRole('status')).textContent).toBe(
      t('prompts.code.sent')
    )
    expect(form.wasSeen()).toBe(false)
  })

  it('keeps the code step with Verify busy until Apple answers, and never shows the form before success', async () => {
    const apple = holdApple()
    const user = await openSignIn('happy', apple.appleAnswer)
    await submitForm(user)
    await apple.release()
    await apple.release()
    const form = await watchForForm()
    await enterCode(user, '123456')

    const code = screen.getByRole('dialog', { name: t('prompts.code.title') })
    expect(
      isPending(
        within(code).getByRole('button', { name: t('prompts.code.verify') })
      )
    ).toBe(true)
    expect(within(code).getByText(t('prompts.code.checking'))).toBeDefined()
    expect(
      within(code)
        .getByRole('button', { name: t('prompts.cancel') })
        .hasAttribute('disabled')
    ).toBe(true)

    await apple.release()
    expect(await closeSignedIn(user)).toContain(NEW_ID)
    expect(form.wasSeen()).toBe(false)
  })

  it('returns to the code step with the wrong-code alert, not to the form', async () => {
    const apple = holdApple()
    const user = await openSignIn('happy', apple.appleAnswer)
    await submitForm(user)
    await apple.release()
    await apple.release()
    const form = await watchForForm()
    await enterCode(user, '000000')
    await apple.release()

    const again = await screen.findByRole('alert')
    expect(again.textContent).toBe(t('prompts.code.wrong'))
    expect(
      screen.getByRole('dialog', { name: t('prompts.code.title') })
    ).toBeDefined()
    expect(form.wasSeen()).toBe(false)
  })
})

describe('Add Apple ID, saving the password', () => {
  /** The fake Engine's sign-in, recording what it was asked. */
  const recordingSignIn = () => {
    const fake = createFakeEngine({
      delayMs: 0,
      appleDelayMs: 0,
      scenario: 'sign-in-no-2fa'
    })
    const signIn = vi.fn(fake.signIn)
    const engine = createFakeEngineClient({
      delayMs: 0,
      appleDelayMs: 0,
      overrides: { signIn }
    })

    return { engine, signIn }
  }

  const signInWith = async (save: boolean) => {
    const user = userEvent.setup()
    const { engine, signIn } = recordingSignIn()
    await renderApp('/accounts', { engine })
    await user.click(
      await within(await screen.findByRole('main')).findByRole('button', {
        name: t('topBar.addAppleId')
      })
    )
    const form = await screen.findByRole('dialog', { name: t('signIn.title') })
    const checkbox = within(form).getByRole('checkbox', {
      name: new RegExp(t('signIn.rememberPassword'))
    }) as HTMLInputElement
    expect(checkbox.checked).toBe(true)
    if (!save) await user.click(checkbox)
    await user.type(within(form).getByLabelText(/Apple ID/), NEW_ID)
    await user.type(within(form).getByLabelText(/Password/), 'secret')
    await user.click(
      within(form).getByRole('button', { name: t('signIn.submit') })
    )
    await screen.findByRole('dialog', { name: t('signIn.done.title') })

    return signIn.mock.calls[0]?.[0]
  }

  it('is on by default, and the Engine is asked to save it', async () => {
    expect(await signInWith(true)).toEqual({
      appleId: NEW_ID,
      rememberPassword: true
    })
  })

  it('asks the Engine not to save it when unchecked', async () => {
    expect(await signInWith(false)).toEqual({
      appleId: NEW_ID,
      rememberPassword: false
    })
  })
})
