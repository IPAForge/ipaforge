// `apple-probe signin`, `accounts` and `forget`: managing the saved Apple IDs.
import { rm } from 'node:fs/promises'

import type { AppleProbe } from '@desktop/probes/apple/context.ts'
import { describeError } from '@desktop/probes/apple/describe-error.ts'
import { newSignIn } from '@desktop/probes/apple/session.ts'

/** Checks every saved account's session. */
export const accountsCommand =
  (probe: AppleProbe) => async (): Promise<void> => {
    const { apple } = probe
    const accounts = await apple.accounts.list()
    if (accounts.length === 0) {
      console.log('No saved accounts.')
      return
    }
    console.log('\nSaved accounts — checking each saved session:')
    for (const account of accounts) {
      try {
        await apple.accounts.switchTo(account.id)
        const resumed = await apple.resume(account.id)
        console.log(
          `  ${account.appleId}: ${resumed.kind === 'signed_in' ? '✓ session valid' : resumed.kind}`
        )
      } catch (error) {
        console.log(`  ${account.appleId}: ✗ ${describeError(error)}`)
      }
    }
  }

/** Signs in and fetches a developer-services token; a failure is reported, not thrown. */
const signInOnce = async (probe: AppleProbe) => {
  try {
    const session = await newSignIn(probe)
    const token = await probe.apple.appToken(session)
    console.log(
      `  ✓ developer-services token received, valid until ${token.expiresAt.toISOString()}`
    )
  } catch (error) {
    console.log(`  ✗ ${describeError(error)}`)
  }
}

/** Signs in one or more Apple IDs, then checks all saved accounts. */
export const signInCommand = (probe: AppleProbe) => async (): Promise<void> => {
  do {
    await signInOnce(probe)
  } while (await probe.prompt.confirm('\nAdd another Apple ID? [y/N] '))
  await accountsCommand(probe)()
}

/** Deletes saved accounts, sessions and passwords; the machine identity is kept. */
export const forgetCommand = (probe: AppleProbe) => async (): Promise<void> => {
  for (const account of await probe.apple.accounts.list())
    await probe.apple.accounts.remove(account.id)
  await rm(probe.secretsFile, { force: true })
  console.log(
    'Saved accounts, sessions and passwords deleted (the machine identity is kept).'
  )
}
