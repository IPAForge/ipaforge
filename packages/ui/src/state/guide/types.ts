import type { guideStatuses } from '@ui/state/guide/constants.ts'

/** Open (shown instead of the pages), later (a banner offers to continue), or finished. */
export type GuideStatus = (typeof guideStatuses)[number]

export type GuideState = {
  readonly status: GuideStatus
  /** The step shown, by id. */
  readonly step: string
  /** The steps done (Continue pressed), by id. */
  readonly done: readonly string[]
  /** The team picked in the guide, for its install. */
  readonly teamId?: string | undefined
  /** Not now on the banner: hidden until IPAForge opens again. */
  readonly isBannerHidden: boolean
  /** The tour's stop shown, by index; none while the tour is closed (it isn't saved). */
  readonly tourStop?: number | undefined
}

export type GuideStore = {
  /** Opens at launch while no Apple ID is saved (off in tests unless they ask for it). */
  readonly opensByItself: boolean
  getState: () => GuideState
  subscribe: (listener: () => void) => () => void
  /** Opens the guide at a step (where it was, by default). */
  open: (step?: string) => void
  goTo: (step: string) => void
  /** Marks a step done and moves to `next`. */
  complete: (step: string, next: string | undefined) => void
  /** Finish later: the pages come back, with a banner to continue, and the tour starts. */
  later: () => void
  /** Closes the guide however it ends (Done, I know my way around) and starts the tour. */
  finish: () => void
  /** Shows a stop of the tour (0 starts it), or closes it. */
  showTourStop: (stop: number | undefined) => void
  chooseTeam: (teamId: string) => void
  hideBanner: () => void
}
