import { describe, expect, it, vi } from 'vitest'

import { ErrorCode, silentLogger } from '@ipaforge/kernel'
import { PromptKind } from '@ipaforge/rpc'
import { FAKE_IPHONE, STUDIO_TEAM } from '@ui/services/engine/fake/fake-data.ts'
import { createFakeEngineClient } from '@ui/services/engine/fake/fake-engine-client.ts'
import type { FakeScenarioId } from '@ui/services/engine/fake/types.ts'
import { createActiveRunStore } from '@ui/state/active-run/active-run-store.ts'
import type { ActiveRunStore, RunStatus } from '@ui/state/active-run/types.ts'

const INPUT = {
  udid: FAKE_IPHONE,
  accountId: 'work@example.com',
  variant: 'sidestore' as const
}

const setup = (scenario: FakeScenarioId = 'happy') => {
  const onSettled = vi.fn()
  const store = createActiveRunStore({
    engine: createFakeEngineClient({ scenario, delayMs: 0 }),
    logger: silentLogger,
    onSettled
  })

  return { store, onSettled }
}

const until = (store: ActiveRunStore, status: RunStatus) =>
  vi.waitFor(() => expect(store.getState()?.view.status).toBe(status))

describe('createActiveRunStore', () => {
  it('follows a run to the end and tells the app', async () => {
    const { store, onSettled } = setup()
    store.start(INPUT)
    expect(store.getState()?.view.status).toBe('starting')
    await until(store, 'completed')
    expect(onSettled).toHaveBeenCalledTimes(1)
    expect(store.getState()?.input).toEqual(INPUT)
  })

  it('does not start a second run while one is going', async () => {
    const { store } = setup('two-teams')
    store.start(INPUT)
    store.start({ ...INPUT, variant: 'livecontainer' })
    await until(store, 'waiting')
    expect(store.getState()?.input.variant).toBe('sidestore')
  })

  it('answers the waiting prompt through the run handle', async () => {
    const { store } = setup('two-teams')
    store.start(INPUT)
    await until(store, 'waiting')
    expect(store.getState()?.view.prompt?.kind).toBe(PromptKind.ChooseTeam)

    store.answer(STUDIO_TEAM.id)
    // The question stays on screen, busy, until the Engine moves on.
    expect(store.getState()?.view.status).toBe('answering')
    await until(store, 'completed')
    // A paid team has no free-app limit: the step is skipped.
    expect(
      store.getState()?.view.steps.find((step) => step.id === 'free-apps-0')
        ?.state
    ).toBe('skipped')
  })

  it('stops on a declined prompt and resumes from the checkpoint', async () => {
    const { store } = setup('two-teams')
    store.start(INPUT)
    await until(store, 'waiting')
    store.decline()
    await until(store, 'cancelled')
    const done = store
      .getState()
      ?.view.steps.filter((step) => step.state === 'done')
      .map((step) => step.id)
    expect(done).toContain('download-0')

    store.resume()
    await until(store, 'waiting')
    store.answer(STUDIO_TEAM.id)
    await until(store, 'completed')
  })

  it('shows an automatic retry as the step detail until the step goes on', async () => {
    const { store } = setup('retry')
    const details = new Set<string | undefined>()
    store.subscribe(() =>
      details.add(
        store.getState()?.view.steps.find((step) => step.id === 'download-0')
          ?.detail?.kind
      )
    )
    store.start(INPUT)
    await until(store, 'completed')
    expect(details).toContain('retrying')
    expect(details).toContain('bytes')
  })

  it('cancels a running run', async () => {
    const { store } = setup('certificate-limit')
    store.start(INPUT)
    await until(store, 'waiting')
    store.cancel()
    await until(store, 'cancelled')
    expect(store.getState()?.view.checkpoint).toBeDefined()
  })

  it('fails with the error, then restarts with another Apple ID', async () => {
    const { store } = setup('profile-banned')
    store.start(INPUT)
    await until(store, 'failed')
    expect(store.getState()?.view.failure?.error.code).toBe(
      ErrorCode.ProfileBanned
    )

    store.restart({ accountId: 'studio@example.com' })
    expect(store.getState()?.input.accountId).toBe('studio@example.com')
    await until(store, 'waiting')
  })

  it('forgets a run that ended, but not one that is going', async () => {
    const { store } = setup('certificate-limit')
    store.start(INPUT)
    await until(store, 'waiting')
    store.dismiss()
    expect(store.getState()).toBeDefined()
    store.cancel()
    await until(store, 'cancelled')
    store.dismiss()
    expect(store.getState()).toBeUndefined()
  })
})
