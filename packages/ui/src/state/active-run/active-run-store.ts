// The install run, kept outside any component so it goes on while the user visits other sections. It follows
// the run handle's events into a RunView, forwards answers, and starts the next run: resumed from the last
// checkpoint, or anew with a changed input (another Apple ID or channel).
import { compact, type Logger, toLoadstarError } from '@loadstar/kernel'
import type { EngineClient, RemoteResult } from '@loadstar/rpc'
import type {
  InstallRun,
  InstallSideStoreInput
} from '@ui/services/engine/engine-types.ts'
import {
  answeredView,
  brokenView,
  finishedView,
  isRunActive,
  type RunView,
  reduceRunEvent,
  startingView
} from '@ui/state/active-run/run-view.ts'

export type ActiveRun = {
  readonly input: InstallSideStoreInput
  readonly view: RunView
}

export type ActiveRunStore = {
  getState: () => ActiveRun | undefined
  subscribe: (listener: () => void) => () => void
  start: (input: InstallSideStoreInput) => void
  /** Continues a failed or cancelled run from its checkpoint. */
  resume: () => void
  /** Starts again with part of the input changed; finished steps that do not depend on it run quickly again. */
  restart: (patch: Partial<InstallSideStoreInput>) => void
  answer: (answer: unknown) => void
  decline: () => void
  cancel: () => void
  /** Forgets a run that has ended. */
  dismiss: () => void
}

export type ActiveRunStoreOptions = {
  readonly engine: EngineClient
  readonly logger: Logger
  /** Called when a run ends, however it ends (e.g. to refresh accounts the run changed). */
  readonly onSettled?: () => void
}

export const createActiveRunStore = ({
  engine,
  logger,
  onSettled
}: ActiveRunStoreOptions): ActiveRunStore => {
  const log = logger.child({ scope: 'run' })
  const listeners = new Set<() => void>()
  let state: ActiveRun | undefined
  let handle: InstallRun | undefined
  let stopFollowing: (() => void) | undefined

  const set = (next: ActiveRun | undefined) => {
    state = next
    for (const listener of [...listeners]) listener()
  }

  const setView = (run: InstallRun, update: (view: RunView) => RunView) => {
    if (run !== handle || !state) return
    set({ ...state, view: update(state.view) })
  }

  const settle = (run: InstallRun, result: RemoteResult<unknown>) => {
    log.info('install run ended', { status: result.status })
    setView(run, (view) => finishedView(view, result))
    onSettled?.()
  }

  const fail = (run: InstallRun, error: unknown) => {
    const failure = toLoadstarError(error)
    log.warn('install run broke off', { code: failure.code })
    setView(run, (view) => brokenView(view, failure))
    onSettled?.()
  }

  const launch = (input: InstallSideStoreInput, previous?: RunView) => {
    stopFollowing?.()
    const resume = previous?.checkpoint
    const run = engine.installSideStore(input, compact({ resume }))
    handle = run
    set({ input, view: startingView(resume ? previous : undefined) })
    log.info('install run started', {
      variant: input.variant,
      resumed: resume !== undefined
    })
    stopFollowing = run.subscribe((event) =>
      setView(run, (view) => reduceRunEvent(view, event))
    )
    run.result.then(
      (result) => settle(run, result),
      (error: unknown) => fail(run, error)
    )
  }

  const whileWaiting = (act: (run: InstallRun) => void) => {
    if (!handle || state?.view.status !== 'waiting') return
    act(handle)
  }

  return {
    getState: () => state,
    subscribe: (listener) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    start: (input) => {
      if (!isRunActive(state?.view)) launch(input)
    },
    resume: () => {
      if (state?.view.checkpoint) launch(state.input, state.view)
    },
    restart: (patch) => {
      if (state && !isRunActive(state.view))
        launch({ ...state.input, ...patch })
    },
    answer: (answer) =>
      whileWaiting((run) => {
        run.answer(answer)
        setView(run, answeredView)
      }),
    decline: () => whileWaiting((run) => run.decline()),
    cancel: () => {
      if (isRunActive(state?.view)) handle?.cancel()
    },
    dismiss: () => {
      if (isRunActive(state?.view)) return
      stopFollowing?.()
      handle = undefined
      set(undefined)
    }
  }
}
