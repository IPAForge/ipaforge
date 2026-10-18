import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactElement } from 'react'
import { describe, expect, it, vi } from 'vitest'

import { renderInApp } from '@ui/__tests__/hook-wrapper.tsx'
import { t } from '@ui/__tests__/test-i18n.ts'
import { PasswordPrompt } from '@ui/components/prompts/password-prompt.tsx'
import { TwoFactorCodePrompt } from '@ui/components/prompts/two-factor-code-prompt.tsx'
import { TwoFactorMethodPrompt } from '@ui/components/prompts/two-factor-method-prompt.tsx'

const METHODS = {
  trustedDevice: true,
  phones: [{ id: 7, number: '+1 ••42' }],
  codeLength: 6,
  legacy: false,
  securityKeysOnly: false
}

const show = async (
  prompt: (actions: {
    onAnswer: () => void
    onDecline: () => void
  }) => ReactElement
) => {
  const onAnswer = vi.fn()
  const onDecline = vi.fn()
  await renderInApp(prompt({ onAnswer, onDecline }))
  const dialog = await screen.findByRole('dialog')

  return { onAnswer, onDecline, dialog, user: userEvent.setup() }
}

const button = (dialog: HTMLElement, name: string | RegExp) =>
  within(dialog).getByRole('button', { name })

describe('prompt dialogs', () => {
  it('password: names the Apple ID and answers with what was typed', async () => {
    const { dialog, user, onAnswer } = await show((actions) => (
      <PasswordPrompt
        data={{ appleId: 'work@example.com' }}
        declineLabelKey="prompts.cancel"
        {...actions}
      />
    ))
    expect(dialog.textContent).toContain('work@example.com')
    const submit = button(dialog, t('prompts.continue'))
    expect(submit.hasAttribute('disabled')).toBe(true)
    await user.type(within(dialog).getByLabelText(/Password/), 'secret')
    await user.click(submit)
    expect(onAnswer).toHaveBeenCalledWith('secret')
  })

  it('two-factor method: a trusted device, or a text message to a number', async () => {
    const { dialog, user, onAnswer } = await show((actions) => (
      <TwoFactorMethodPrompt
        data={{ methods: METHODS }}
        declineLabelKey="prompts.cancel"
        {...actions}
      />
    ))
    await user.click(
      button(dialog, new RegExp(t('prompts.method.trustedDevice')))
    )
    expect(onAnswer).toHaveBeenLastCalledWith({ type: 'trusted_device' })
    await user.click(button(dialog, /\+1 ••42/))
    expect(onAnswer).toHaveBeenLastCalledWith({ type: 'sms', phoneId: 7 })
  })

  it('two-factor method: only the methods Apple offers', async () => {
    const { dialog } = await show((actions) => (
      <TwoFactorMethodPrompt
        data={{ methods: { ...METHODS, trustedDevice: false } }}
        declineLabelKey="prompts.cancel"
        {...actions}
      />
    ))
    expect(
      within(dialog).queryByRole('button', {
        name: new RegExp(t('prompts.method.trustedDevice'))
      })
    ).toBeNull()
  })

  it('two-factor code: answers once all digits are in', async () => {
    const { dialog, user, onAnswer } = await show((actions) => (
      <TwoFactorCodePrompt
        data={{
          method: { type: 'trusted_device' },
          codeLength: 6,
          retry: false,
          phones: []
        }}
        declineLabelKey="prompts.cancel"
        {...actions}
      />
    ))
    expect(within(dialog).queryByRole('alert')).toBeNull()
    const verify = button(dialog, t('prompts.code.verify'))
    await user.type(within(dialog).getByRole('textbox'), '123')
    expect(verify.hasAttribute('disabled')).toBe(true)
    await user.type(within(dialog).getByRole('textbox'), '456')
    await user.click(verify)
    expect(onAnswer).toHaveBeenCalledWith('123456')
  })

  it('two-factor code: sends a new code, or texts one to a number instead', async () => {
    const { dialog, user, onAnswer } = await show((actions) => (
      <TwoFactorCodePrompt
        data={{
          method: { type: 'trusted_device' },
          codeLength: 6,
          retry: false,
          phones: [{ id: 7, number: '+40 ••• ••• •12' }]
        }}
        declineLabelKey="prompts.cancel"
        {...actions}
      />
    ))
    expect(dialog.textContent).toContain(
      t('prompts.code.deviceBody', { length: 6 })
    )
    expect(dialog.textContent).toContain(t('prompts.code.allowHint'))
    await user.click(button(dialog, t('prompts.code.resend')))
    expect(onAnswer).toHaveBeenLastCalledWith({ resend: true })
    await user.click(
      button(dialog, t('prompts.code.textTo', { number: '+40 ••• ••• •12' }))
    )
    expect(onAnswer).toHaveBeenLastCalledWith({ textTo: 7 })
  })

  it('two-factor code: says where a texted code went, and whether a new one was sent', async () => {
    const phone = { id: 7, number: '+40 ••• ••• •12' }
    const sent = await show((actions) => (
      <TwoFactorCodePrompt
        data={{
          method: { type: 'sms', phoneId: 7 },
          codeLength: 6,
          retry: false,
          resent: true,
          phones: [phone]
        }}
        declineLabelKey="prompts.cancel"
        {...actions}
      />
    ))
    expect(sent.dialog.textContent).toContain(
      t('prompts.code.smsBody', { length: 6, number: phone.number })
    )
    expect(within(sent.dialog).getByRole('status').textContent).toBe(
      t('prompts.code.sent')
    )
    expect(
      within(sent.dialog).queryByRole('button', {
        name: t('prompts.code.textTo', { number: phone.number })
      })
    ).toBeNull()
  })

  it('two-factor code: says when Apple sent no new code', async () => {
    const { dialog } = await show((actions) => (
      <TwoFactorCodePrompt
        data={{
          method: { type: 'trusted_device' },
          codeLength: 6,
          retry: false,
          resent: false,
          phones: []
        }}
        declineLabelKey="prompts.cancel"
        {...actions}
      />
    ))
    expect(within(dialog).getByRole('alert').textContent).toBe(
      t('prompts.code.notSent')
    )
  })

  it('two-factor code: says the last code was wrong', async () => {
    const { dialog } = await show((actions) => (
      <TwoFactorCodePrompt
        data={{
          method: { type: 'sms', phoneId: 7 },
          codeLength: 6,
          retry: true,
          phones: []
        }}
        declineLabelKey="prompts.cancel"
        {...actions}
      />
    ))
    expect(within(dialog).getByRole('alert').textContent).toBe(
      t('prompts.code.wrong')
    )
  })

  it('declines with the caller’s label', async () => {
    const { dialog, user, onDecline, onAnswer } = await show((actions) => (
      <TwoFactorMethodPrompt
        data={{ methods: METHODS }}
        declineLabelKey="prompts.cancel"
        {...actions}
      />
    ))
    await user.click(button(dialog, t('prompts.cancel')))
    expect(onDecline).toHaveBeenCalledTimes(1)
    expect(onAnswer).not.toHaveBeenCalled()
  })
})
