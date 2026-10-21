import type { PreferencesStore } from '@ui/services/preferences/preferences-store.ts'
import { GuideKey, guideStatuses } from '@ui/state/guide/constants.ts'
import type {
  GuideState,
  GuideStatus,
  GuideStore
} from '@ui/state/guide/types.ts'

const FIRST_STEP = 'welcome'

const readDone = (saved: string | undefined): string[] => {
  try {
    const parsed: unknown = JSON.parse(saved ?? '[]')

    return Array.isArray(parsed)
      ? parsed.filter((id): id is string => typeof id === 'string')
      : []
  } catch {
    return []
  }
}

/** The status saved, or finished: the guide opens by itself only while no Apple ID is saved (`GuideAutoOpen`). */
const readStatus = (preferences: PreferencesStore): GuideStatus => {
  const saved = preferences.read(GuideKey.status)

  return guideStatuses.find((status) => status === saved) ?? 'finished'
}

/** The setup guide's progress, saved with the UI preferences so it picks up where it was left. */
export const createGuideStore = (
  preferences: PreferencesStore,
  opensByItself = true
): GuideStore => {
  const listeners = new Set<() => void>()
  let state: GuideState = {
    status: readStatus(preferences),
    step: preferences.read(GuideKey.step) ?? FIRST_STEP,
    done: readDone(preferences.read(GuideKey.done)),
    teamId: preferences.read(GuideKey.team),
    isBannerHidden: false
  }
  const set = (next: Partial<GuideState>) => {
    state = { ...state, ...next }
    preferences.write(GuideKey.status, state.status)
    preferences.write(GuideKey.step, state.step)
    preferences.write(GuideKey.done, JSON.stringify(state.done))
    if (state.teamId) preferences.write(GuideKey.team, state.teamId)
    for (const listener of [...listeners]) listener()
  }

  return {
    opensByItself,
    getState: () => state,
    subscribe: (listener) => {
      listeners.add(listener)

      return () => {
        listeners.delete(listener)
      }
    },
    open: (step) =>
      set({ status: 'open', step: step ?? state.step, tourStop: undefined }),
    goTo: (step) => set({ step }),
    complete: (step, next) =>
      set({
        done: state.done.includes(step) ? state.done : [...state.done, step],
        step: next ?? state.step
      }),
    later: () => set({ status: 'later', tourStop: 0 }),
    finish: () => set({ status: 'finished', step: FIRST_STEP, tourStop: 0 }),
    showTourStop: (tourStop) => set({ tourStop }),
    chooseTeam: (teamId) => set({ teamId }),
    hideBanner: () => set({ isBannerHidden: true })
  }
}
