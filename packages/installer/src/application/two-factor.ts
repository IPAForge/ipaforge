// Completes a second-factor challenge through prompts. With trusted devices, the code question comes straight away
// (Apple has pushed a code); otherwise the method is picked first. The code question can also ask for a new code,
// by the same way or by text message; a wrong code asks again, up to the configured number of attempts.
import { ask } from '@installer/application/ask.ts'
import { PromptKind } from '@installer/domain/prompts.ts'
import type { TwoFactorCodeAnswer } from '@installer/domain/types.ts'
import type { StepContext } from '@installer/pipeline/types.ts'
import type {
  AppleSession,
  TwoFactorChallenge,
  TwoFactorMethod,
  TwoFactorMethods
} from '@ipaforge/apple'
import { ErrorCode, IPAForgeError } from '@ipaforge/kernel'

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
    throw new IPAForgeError(ErrorCode.TwoFactorUnsupported, {
      message: 'no second-factor method offered'
    })
  if (offered.length === 1) return only
  return ask(context, PromptKind.TwoFactorMethod, { methods })
}

const isInvalidCode = (error: unknown): boolean =>
  error instanceof IPAForgeError &&
  error.code === ErrorCode.TwoFactorInvalidCode

/** Trusted devices first (their code is already on the way); otherwise the method the user picks. */
const firstMethod = async (
  context: StepContext,
  methods: TwoFactorMethods
): Promise<TwoFactorMethod> =>
  methods.trustedDevice
    ? { type: 'trusted_device' }
    : chooseMethod(context, methods)

/** Asks Apple for another code, by the method given; says whether Apple sent it. */
const requestAnother = async (
  challenge: TwoFactorChallenge,
  method: TwoFactorMethod
): Promise<boolean> => {
  try {
    await challenge.requestCode(method)
    return true
  } catch {
    return false
  }
}

const methodFor = (
  answer: Exclude<TwoFactorCodeAnswer, string>,
  current: TwoFactorMethod
): TwoFactorMethod =>
  'textTo' in answer ? { type: 'sms', phoneId: answer.textTo } : current

/** Asks for the code until Apple accepts one, sending a new one whenever the user asks for it. */
const answerUntilAccepted = async (
  context: StepContext,
  challenge: TwoFactorChallenge,
  methods: TwoFactorMethods,
  first: TwoFactorMethod,
  attempts: number
): Promise<AppleSession> => {
  let method = first
  let wrong = 0
  let resent: boolean | undefined
  for (;;) {
    const answer = await ask(context, PromptKind.TwoFactorCode, {
      method,
      codeLength: methods.codeLength,
      retry: wrong > 0 && resent === undefined,
      phones: methods.phones,
      ...(resent === undefined ? {} : { resent })
    })
    if (typeof answer !== 'string') {
      method = methodFor(answer, method)
      resent = await requestAnother(challenge, method)
      continue
    }
    resent = undefined
    try {
      return await challenge.submitCode(method, answer)
    } catch (error) {
      wrong++
      if (!isInvalidCode(error) || wrong >= attempts) throw error
    }
  }
}

export const completeTwoFactor = async (
  context: StepContext,
  challenge: TwoFactorChallenge,
  attempts: number
): Promise<AppleSession> => {
  const methods = await challenge.methods()
  const method = await firstMethod(context, methods)
  // Apple already pushed a code to trusted devices when it asked for the second factor.
  if (method.type !== 'trusted_device') await challenge.requestCode(method)
  return answerUntilAccepted(context, challenge, methods, method, attempts)
}
