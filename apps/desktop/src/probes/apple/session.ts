import type { AppleProbe } from '@desktop/probes/apple/context.ts'
import { completeTwoFactor } from '@desktop/probes/apple/two-factor.ts'
import type { AppleSession, SavedAccount } from '@ipaforge/apple'
import { compact } from '@ipaforge/kernel'

/** Shows only the first and last two characters. */
const mask = (value: string) =>
  value.length <= 4 ? '****' : `${value.slice(0, 2)}…${value.slice(-2)}`

/** A new interactive sign-in; the session is saved, the password only if the user agrees. */
export const newSignIn = async (
  probe: AppleProbe,
  presetAppleId?: string
): Promise<AppleSession> => {
  const { apple, prompt, persistAccounts } = probe
  const appleId =
    presetAppleId ?? (await prompt.ask('\nApple ID (email or phone): ')).trim()
  const password = await prompt.askHidden(`Password for ${appleId} (hidden): `)
  const started = Date.now()
  const result = await apple.signIn({ appleId, password })
  const session =
    result.kind === 'signed_in'
      ? result.session
      : await completeTwoFactor(prompt, result.challenge)
  const remember =
    persistAccounts &&
    (await prompt.confirm(
      '  Save the password in your Keychain-protected store too? [y/N] '
    ))
  const account = await apple.accounts.save(
    session,
    compact({ rememberPassword: remember ? password : undefined })
  )
  console.log(
    `  ✓ signed in as ${account.displayName ?? '(no name)'} [adsid ${mask(session.adsid)}] in ${Date.now() - started} ms` +
      (persistAccounts ? ' — session saved' : '')
  )
  return session
}

/** Lists the saved accounts and returns the one picked, or undefined for "another Apple ID". */
const pickSavedAccount = async (
  probe: AppleProbe,
  saved: readonly SavedAccount[]
): Promise<SavedAccount | undefined> => {
  console.log('\nSaved accounts:')
  for (const [i, account] of saved.entries())
    console.log(
      `  ${i + 1}. ${account.appleId} (${account.displayName ?? '?'})`
    )
  console.log(`  ${saved.length + 1}. another Apple ID`)
  return saved[
    Number(
      (await probe.prompt.ask(
        `Choose [1-${saved.length + 1}] (default 1): `
      )) || '1'
    ) - 1
  ]
}

/** Re-uses a saved session, completing 2FA or signing in again when Apple asks for it. */
const resumeSaved = async (
  probe: AppleProbe,
  account: SavedAccount
): Promise<AppleSession> => {
  const resumed = await probe.apple.resume(account.id)
  if (resumed.kind === 'signed_in') {
    console.log(`  ✓ using the saved session for ${account.appleId}`)
    return resumed.session
  }
  if (resumed.kind === 'two_factor')
    return completeTwoFactor(probe.prompt, resumed.challenge)
  console.log('  The saved session expired; please sign in again.')
  return newSignIn(probe, account.appleId)
}

/** Offers saved accounts first (re-using their sessions), otherwise signs in. */
export const obtainSession = async (
  probe: AppleProbe
): Promise<AppleSession> => {
  const saved = await probe.apple.accounts.list()
  if (saved.length === 0) return newSignIn(probe)
  const picked = await pickSavedAccount(probe, saved)

  return picked ? resumeSaved(probe, picked) : newSignIn(probe)
}
