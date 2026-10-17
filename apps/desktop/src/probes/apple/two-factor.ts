import type { Prompt } from '@desktop/probes/shared/types.ts'
import type {
  AppleSession,
  TwoFactorChallenge,
  TwoFactorMethod,
  TwoFactorMethods
} from '@loadstar/apple'
import { LoadstarError } from '@loadstar/kernel'

type MethodOption = {
  readonly label: string
  readonly method: TwoFactorMethod
}

const methodOptions = (methods: TwoFactorMethods): MethodOption[] => {
  const options: MethodOption[] = []
  if (methods.trustedDevice)
    options.push({
      label: 'code shown on your trusted device',
      method: { type: 'trusted_device' }
    })
  for (const phone of methods.phones)
    options.push({
      label: `SMS to ${phone.number}`,
      method: { type: 'sms', phoneId: phone.id }
    })
  return options
}

/** Lists the methods and returns the one picked (the first by default). */
const chooseMethod = async (
  prompt: Prompt,
  options: readonly MethodOption[]
): Promise<TwoFactorMethod> => {
  for (const [i, option] of options.entries())
    console.log(`    ${i + 1}. ${option.label}`)
  const choice =
    options[
      Number(await prompt.ask(`  Choose [1-${options.length}] (default 1): `)) -
        1
    ] ?? options[0]
  if (!choice) throw new Error('no second-factor method available')
  return choice.method
}

const isInvalidCode = (error: unknown): boolean =>
  error instanceof LoadstarError &&
  error.code === 'apple.two_factor_invalid_code'

/** Asks for the code until Apple accepts one; "resend" requests a new code. */
const enterCode = async (
  prompt: Prompt,
  challenge: TwoFactorChallenge,
  method: TwoFactorMethod,
  codeLength: number
): Promise<AppleSession> => {
  for (;;) {
    const code = (
      await prompt.ask(`  Enter the ${codeLength}-digit code (or "resend"): `)
    ).trim()
    if (code === 'resend') {
      await challenge.requestCode(method)
      console.log('  Sent again.')
      continue
    }
    try {
      return await challenge.submitCode(method, code)
    } catch (error) {
      if (!isInvalidCode(error)) throw error
      console.log('  That code was not accepted; try again.')
    }
  }
}

export const completeTwoFactor = async (
  prompt: Prompt,
  challenge: TwoFactorChallenge
): Promise<AppleSession> => {
  console.log(
    `  Apple asks for a second factor (${challenge.requested.replace('_', ' ')}).`
  )
  const methods = await challenge.methods()
  const method = await chooseMethod(prompt, methodOptions(methods))
  if (method.type !== 'trusted_device') await challenge.requestCode(method)
  return enterCode(prompt, challenge, method, methods.codeLength)
}
