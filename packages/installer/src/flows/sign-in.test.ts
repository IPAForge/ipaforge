import { describe, expect, it } from 'vitest'

import { ACCOUNT, twoFactorChallenge } from '@installer/__tests__/fakes.ts'
import { createHarness, scripted } from '@installer/__tests__/harness.ts'
import { PromptKind } from '@installer/domain/prompts.ts'
import type { RunEvent } from '@installer/engine/types.ts'
import { ErrorCode } from '@ipaforge/kernel'

const input = { appleId: ACCOUNT }

describe('signIn', () => {
  it('asks for the password, signs in and saves the account', async () => {
    const h = createHarness()
    const prompts = scripted({ [PromptKind.Password]: () => 'secret' })
    const result = await h.engine.signIn(input, { onPrompt: prompts }).result

    expect(result.status === 'completed' && result.state.account?.id).toBe(
      ACCOUNT
    )
    expect(prompts.asked).toEqual([
      { kind: PromptKind.Password, data: { appleId: ACCOUNT } }
    ])
    expect(h.apple.calls.saved).toBe(1)
  })

  it('saves the password only when asked to', async () => {
    const remembering = createHarness()
    await remembering.engine.signIn(
      { ...input, rememberPassword: true },
      { onPrompt: scripted({ [PromptKind.Password]: () => 'secret' }) }
    ).result
    expect(remembering.apple.calls.savedOptions).toEqual([
      { rememberPassword: 'secret' }
    ])

    const forgetting = createHarness()
    await forgetting.engine.signIn(input, {
      onPrompt: scripted({ [PromptKind.Password]: () => 'secret' })
    }).result
    expect(forgetting.apple.calls.savedOptions).toEqual([{}])
  })

  it('completes a second factor, asking again after a wrong code', async () => {
    const challenge = twoFactorChallenge('123456')
    const h = createHarness({
      apple: { signIn: async () => ({ kind: 'two_factor', challenge }) }
    })
    const codes = ['000000', '123456']
    const prompts = scripted({
      [PromptKind.Password]: () => 'secret',
      [PromptKind.TwoFactorCode]: () => codes.shift()
    })
    const result = await h.engine.signIn(input, { onPrompt: prompts }).result

    expect(result.status).toBe('completed')
    expect(prompts.asked.map((p) => p.kind)).toEqual([
      PromptKind.Password,
      PromptKind.TwoFactorCode,
      PromptKind.TwoFactorCode
    ])
    expect(h.apple.calls.saved).toBe(1)
  })

  it('keeps the password out of the state, and stops when it is declined', async () => {
    const h = createHarness()
    const events: RunEvent[] = []
    const run = h.engine.signIn(input)
    run.subscribe((event) => events.push(event))
    await new Promise((resolve) => setTimeout(resolve, 0))
    run.decline()
    const result = await run.result

    expect(result.status === 'failed' && result.error.code).toBe(
      ErrorCode.PromptCancelled
    )
    expect(result.status !== 'completed' && result.checkpoint.state).toEqual(
      input
    )
    expect(events[0]).toMatchObject({
      type: 'run-started',
      steps: [{ stepId: 'sign-in' }]
    })
  })
})
