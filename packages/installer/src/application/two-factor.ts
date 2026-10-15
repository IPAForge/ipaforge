// Completes a second-factor challenge through prompts: pick a method when there is a choice, then ask for the code
// until Apple accepts one (a wrong code asks again, up to the configured number of attempts).
import { ask } from '@installer/application/ask.ts'
import { PromptKind } from '@installer/domain/prompts.ts'
import type { StepContext } from '@installer/pipeline/step.ts'
import type {
  AppleSession,
  TwoFactorChallenge,
  TwoFactorMethod,
  TwoFactorMethods
} from '@loadstar/apple'
import { ErrorCode, LoadstarError } from '@loadstar/kernel'

const offeredMethods = (methods: TwoFactorMethods): TwoFactorMethod[] => [
  ...(methods.trustedDevice ? [{ type: 'trusted_device' as const }] : []),
  ...methods.phones.map((phone) => ({
    type: 'sms' as const,
    phoneId: phone.id
  }))
]

const chooseMethod = async (
  context: StepContext,
  methods: TwoFactorMethods
): Promise<TwoFactorMethod> => {
  const offered = offeredMethods(methods)
  const [only] = offered
  if (!only)
    throw new LoadstarError(ErrorCode.TwoFactorUnsupported, {
      message: 'no second-factor method offered'
    })
  if (offered.length === 1) return only
  return ask(context, PromptKind.TwoFactorMethod, { methods })
}

const isInvalidCode = (error: unknown): boolean =>
  error instanceof LoadstarError &&
  error.code === ErrorCode.TwoFactorInvalidCode

const submitUntilAccepted = async (
  context: StepContext,
  challenge: TwoFactorChallenge,
  method: TwoFactorMethod,
  codeLength: number,
  attempts: number
): Promise<AppleSession> => {
  for (let attempt = 1; ; attempt++) {
    const code = await ask(context, PromptKind.TwoFactorCode, {
      method,
      codeLength,
      retry: attempt > 1
    })
    try {
      return await challenge.submitCode(method, code)
    } catch (error) {
      if (!isInvalidCode(error) || attempt >= attempts) throw error
    }
  }
}

export const completeTwoFactor = async (
  context: StepContext,
  challenge: TwoFactorChallenge,
  attempts: number
): Promise<AppleSession> => {
  const methods = await challenge.methods()
  const method = await chooseMethod(context, methods)
  // Apple already pushed a code to trusted devices when it asked for the second factor.
  if (method.type !== 'trusted_device') await challenge.requestCode(method)
  return submitUntilAccepted(
    context,
    challenge,
    method,
    methods.codeLength,
    attempts
  )
}
