// The install run, kept outside any component so it goes on while the user visits other sections. It follows
// the run handle's events into a RunView, forwards answers, and starts the next run: resumed from the last
// checkpoint, or anew with a changed input (another Apple ID or channel).
import { compact, toLoadstarError } from '@loadstar/kernel'
import type { RemoteResult } from '@loadstar/rpc'
import type {
  InstallRun,
  InstallSideStoreInput
} from '@ui/services/engine/types.ts'
import {
  answeredView,
  brokenView,
  finishedView,
  isRunActive,
  startingView
} from '@ui/state/active-run/run-view.ts'
import type {
  ActiveRun,
  ActiveRunStore,
  ActiveRunStoreOptions,
  RunView
} from '@ui/state/active-run/types.ts'
import { reduceRunEvent } from '@ui/state/active-run/utils/reduce-run-event.ts'

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

  const now = () => new Date().toISOString()

  const setView = (
    run: InstallRun,
    update: (view: RunView) => RunView,
    endedAt?: string
  ) => {
    if (run !== handle || !state) return
    set({ ...state, view: update(state.view), ...(endedAt ? { endedAt } : {}) })
  }

  const settle = (run: InstallRun, result: RemoteResult<unknown>) => {
    log.info('install run ended', { status: result.status })
    setView(run, (view) => finishedView(view, result), now())
    onSettled?.()
  }

  const fail = (run: InstallRun, error: unknown) => {
    const failure = toLoadstarError(error)
    log.warn('install run broke off', { code: failure.code })
    setView(run, (view) => brokenView(view, failure), now())
    onSettled?.()
  }

  const launch = (input: InstallSideStoreInput, previous?: RunView) => {
    stopFollowing?.()
    const resume = previous?.checkpoint
    const run = engine.installSideStore(input, compact({ resume }))
    handle = run
    // A resumed run's lines start where the run first started.
    const startedAt = (resume && state?.startedAt) || now()
    set({ input, view: startingView(resume ? previous : undefined), startedAt })
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
