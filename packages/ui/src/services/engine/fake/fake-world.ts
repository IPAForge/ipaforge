// The fake Engine's mutable state: the scenario, the saved accounts (sign-in adds one, a ban marks one), which
// accounts have a live session, and which scripted failures already happened.
import { ErrorCode, IPAForgeError } from '@ipaforge/kernel'
import {
  EXPIRED_ACCOUNT,
  FAKE_IPHONE,
  fakeAccounts,
  PERSONAL_TEAM,
  STUDIO_TEAM
} from '@ui/services/engine/fake/fake-data.ts'
import { fakeFailures } from '@ui/services/engine/fake/fake-scenarios.ts'
import type { FakeScenarioId } from '@ui/services/engine/fake/types.ts'
import type { Account, Team } from '@ui/services/engine/types.ts'

export type FakeWorld = {
  readonly scenario: FakeScenarioId
  readonly delayMs: number
  /** Waits as long as Apple takes to answer a sign-in request (checking a password, sending or checking a code). */
  readonly appleAnswer: () => Promise<void>
  accounts: Account[]
  /** Accounts whose saved session Apple still accepts. */
  readonly signedIn: Set<string>
  /** Failures already played (each plays once, so resuming succeeds). */
  readonly failed: Set<string>
  /** Accounts whose password was saved at sign-in: an expired session is renewed with it, without asking. */
  readonly savedPasswords: Set<string>
  /** Accounts with a saved password that Apple wants a code for: signing in again asks only for the code. */
  readonly codeNeeded: Set<string>
}

/** `studio@` as Apple blocked it on the fake iPhone. */
const bannedOnIphone = (account: Account): Account =>
  account.id === 'studio@example.com'
    ? {
        ...account,
        health: { ...account.health, bannedOnDevices: [FAKE_IPHONE] }
      }
    : account

/**
 * The saved Apple IDs: one with a single team and one with two (`studio@`). The `accounts` scenario adds one
 * whose session expired and has Apple block `studio@` on the fake iPhone (`devices` blocks it too);
 * `code-needed` has the same accounts, the expired one with a saved password; `no-accounts` starts with none.
 */
const accountsFor = (scenario: FakeScenarioId): Account[] => {
  if (scenario === 'no-accounts') return []
  const accounts = fakeAccounts()
  if (scenario === 'devices') return accounts.map(bannedOnIphone)
  if (scenario !== 'accounts' && scenario !== 'code-needed') return accounts
  return [...accounts.map(bannedOnIphone), EXPIRED_ACCOUNT]
}

/** Sign-out: the account and its session are forgotten, like the Engine's account store does. */
export const forgetAccount = (world: FakeWorld, accountId: string): void => {
  if (!world.accounts.some((account) => account.id === accountId))
    throw new IPAForgeError(ErrorCode.AccountNotFound, {
      data: { id: accountId }
    })
  world.accounts = world.accounts.filter((account) => account.id !== accountId)
  world.signedIn.delete(accountId)
  world.savedPasswords.delete(accountId)
}

export const createFakeWorld = (
  scenario: FakeScenarioId,
  delayMs: number,
  appleAnswer: () => Promise<void>
): FakeWorld => {
  const accounts = accountsFor(scenario)
  const expired = scenario === 'two-factor'

  return {
    scenario,
    delayMs,
    appleAnswer,
    accounts,
    signedIn: new Set(
      expired
        ? []
        : accounts
            .filter((account) => account.id !== EXPIRED_ACCOUNT.id)
            .map((account) => account.id)
    ),
    failed: new Set(),
    savedPasswords: new Set(),
    codeNeeded: new Set(scenario === 'code-needed' ? [EXPIRED_ACCOUNT.id] : [])
  }
}

export const teamsFor = (world: FakeWorld, accountId: string): Team[] =>
  accountId === 'studio@example.com' || world.scenario === 'two-teams'
    ? [PERSONAL_TEAM, STUDIO_TEAM]
    : [PERSONAL_TEAM]

/** Developer-services queries need a live session, as with the Engine. */
export const requireSession = (world: FakeWorld, accountId: string): void => {
  if (!world.accounts.some((account) => account.id === accountId))
    throw new IPAForgeError(ErrorCode.AccountNotFound, {
      data: { id: accountId }
    })
  if (world.signedIn.has(accountId)) return
  if (world.savedPasswords.has(accountId)) {
    world.signedIn.add(accountId)
    return
  }
  throw new IPAForgeError(ErrorCode.SessionExpired)
}

const markBanned = (world: FakeWorld, accountId: string, udid: string) => {
  world.accounts = world.accounts.map((account) =>
    account.id === accountId
      ? {
          ...account,
          health: {
            ...account.health,
            bannedOnDevices: [...account.health.bannedOnDevices, udid],
            lastError: ErrorCode.ProfileBanned
          }
        }
      : account
  )
}

/** Throws the scenario's failure the first time its step runs. */
export const failOnce = (
  world: FakeWorld,
  stepId: string,
  run: { readonly udid: string; readonly accountId: string }
): void => {
  const failure = fakeFailures[world.scenario]
  if (failure?.stepId !== stepId || world.failed.has(stepId)) return
  world.failed.add(stepId)
  if (failure.code === ErrorCode.ProfileBanned)
    markBanned(world, run.accountId, run.udid)
  throw new IPAForgeError(failure.code, { data: { stepId } })
}
