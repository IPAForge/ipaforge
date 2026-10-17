// The fake Apple sign-in: the password, then a second factor through prompts, as the Engine asks them.
import { ErrorCode, LoadstarError } from '@loadstar/kernel'
import { PromptKind } from '@loadstar/rpc'
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

/** Asks for a method, then for the code until it is the right one (a wrong one asks again). */
export const completeTwoFactor = async (
  context: ScriptedStepContext,
  appleAnswer: () => Promise<void>
): Promise<void> => {
  const method = await context.prompt<TwoFactorMethod>({
    kind: PromptKind.TwoFactorMethod,
    data: { methods: METHODS }
  })
  // Apple sends the code.
  await appleAnswer()
  for (let attempt = 1; attempt <= CODE_ATTEMPTS; attempt++) {
    const code = await context.prompt<string>({
      kind: PromptKind.TwoFactorCode,
      data: {
        method,
        codeLength: METHODS.codeLength,
        retry: attempt > 1
      }
    })
    // Apple checks it.
    await appleAnswer()
    if (code === FAKE_TWO_FACTOR_CODE) return
  }
  throw new LoadstarError(ErrorCode.TwoFactorInvalidCode)
}
