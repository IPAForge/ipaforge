// The fake Engine's mutable state: the scenario, the saved accounts (sign-in adds one, a ban marks one), which
// accounts have a live session, and which scripted failures already happened.
import { ErrorCode, LoadstarError } from '@loadstar/kernel'
import type { Account, Team } from '@ui/services/engine/engine-types.ts'
import {
  fakeAccounts,
  PERSONAL_TEAM,
  STUDIO_TEAM
} from '@ui/services/engine/fake/fake-data.ts'
import {
  type FakeScenarioId,
  fakeFailures
} from '@ui/services/engine/fake/fake-scenarios.ts'

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
}

export const createFakeWorld = (
  scenario: FakeScenarioId,
  delayMs: number,
  appleAnswer: () => Promise<void>
): FakeWorld => {
  const accounts = fakeAccounts()
  const expired = scenario === 'two-factor'

  return {
    scenario,
    delayMs,
    appleAnswer,
    accounts,
    signedIn: new Set(expired ? [] : accounts.map((account) => account.id)),
    failed: new Set()
  }
}

export const teamsFor = (world: FakeWorld, accountId: string): Team[] =>
  accountId === 'studio@example.com' || world.scenario === 'two-teams'
    ? [PERSONAL_TEAM, STUDIO_TEAM]
    : [PERSONAL_TEAM]

/** Developer-services queries need a live session, as with the Engine. */
export const requireSession = (world: FakeWorld, accountId: string): void => {
  if (!world.accounts.some((account) => account.id === accountId))
    throw new LoadstarError(ErrorCode.AccountNotFound, {
      data: { id: accountId }
    })
  if (!world.signedIn.has(accountId))
    throw new LoadstarError(ErrorCode.SessionExpired)
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
  throw new LoadstarError(failure.code, { data: { stepId } })
}
