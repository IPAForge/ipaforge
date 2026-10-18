// The fake Apple sign-in: the password, then a second factor through prompts, as the Engine asks them.
import { ErrorCode, IPAForgeError } from '@ipaforge/kernel'
import { PromptKind, type TwoFactorCodeAnswer } from '@ipaforge/rpc'
import { FAKE_TWO_FACTOR_CODE } from '@ui/services/engine/fake/fake-data.ts'
import type { ScriptedStepContext } from '@ui/services/engine/fake/types.ts'
import type {
  TwoFactorMethod,
  TwoFactorMethods
} from '@ui/services/engine/types.ts'

const CODE_ATTEMPTS = 3

const METHODS: TwoFactorMethods = {
  trustedDevice: true,
  phones: [{ id: 1, number: '+1 ••• ••• ••42' }],
  codeLength: FAKE_TWO_FACTOR_CODE.length,
  legacy: false,
  securityKeysOnly: false
}

export const askPassword = (context: ScriptedStepContext, appleId: string) =>
  context.prompt<string>({ kind: PromptKind.Password, data: { appleId } })

/**
 * The second factor as the Engine asks it: Apple pushes a code to the trusted devices at once, so the code question
 * comes straight away; it can ask for a new code, or for one by text message instead. A wrong code asks again.
 */
export const completeTwoFactor = async (
  context: ScriptedStepContext,
  appleAnswer: () => Promise<void>
): Promise<void> => {
  let method: TwoFactorMethod = { type: 'trusted_device' }
  let wrong = 0
  let resent: boolean | undefined
  // Apple sends the code.
  await appleAnswer()
  for (;;) {
    const answer: TwoFactorCodeAnswer =
      await context.prompt<TwoFactorCodeAnswer>({
        kind: PromptKind.TwoFactorCode,
        data: {
          method,
          codeLength: METHODS.codeLength,
          retry: wrong > 0 && resent === undefined,
          phones: METHODS.phones,
          ...(resent === undefined ? {} : { resent })
        }
      })
    // Apple sends a new code, or checks this one.
    await appleAnswer()
    if (typeof answer !== 'string') {
      if ('textTo' in answer) method = { type: 'sms', phoneId: answer.textTo }
      resent = true
      continue
    }
    resent = undefined
    if (answer === FAKE_TWO_FACTOR_CODE) return
    wrong++
    if (wrong >= CODE_ATTEMPTS)
      throw new IPAForgeError(ErrorCode.TwoFactorInvalidCode)
  }
}
