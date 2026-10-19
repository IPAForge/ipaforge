// The install run, kept outside any component so it goes on while the user visits other sections: SideStore from
// the Install page or a list of apps from the Preload page, one at a time since it holds the device. It follows the
// run handle's events into a RunView, forwards answers, and starts the next run: resumed from the last checkpoint,
// or anew with a changed input (another Apple ID or channel).
import { compact, toIPAForgeError } from '@ipaforge/kernel'
import type { RemoteResult } from '@ipaforge/rpc'
import type { InstallRun } from '@ui/services/engine/types.ts'
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
  RunRequest,
  RunView
} from '@ui/state/active-run/types.ts'
import { reduceRunEvent } from '@ui/state/active-run/utils/reduce-run-event.ts'
import {
  launchRun,
  patchedRequest,
  runLogFields
} from '@ui/state/active-run/utils/run-requests.ts'

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
    const failure = toIPAForgeError(error)
    log.warn('install run broke off', { code: failure.code })
    setView(run, (view) => brokenView(view, failure), now())
    onSettled?.()
  }

  const launch = (request: RunRequest, previous?: RunView) => {
    stopFollowing?.()
    const resume = previous?.checkpoint
    const run = launchRun(engine, request, compact({ resume }))
    handle = run
    // A resumed run's lines start where the run first started.
    const startedAt = (resume && state?.startedAt) || now()
    set({
      ...request,
      view: startingView(resume ? previous : undefined),
      startedAt
    })
    log.info('install run started', {
      ...runLogFields(request),
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
      if (!isRunActive(state?.view)) launch({ kind: 'sidestore', input })
    },
    startRepair: (input, repair) => {
      if (!isRunActive(state?.view))
        launch({ kind: 'sidestore', input, repair })
    },
    startApps: (input, apps, options) => {
      if (!isRunActive(state?.view))
        launch({ kind: 'apps', input, apps, ...options })
    },
    resume: () => {
      if (state?.view.checkpoint) launch(state, state.view)
    },
    restart: (patch) => {
      if (state && !isRunActive(state.view))
        launch(patchedRequest(state, patch))
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
