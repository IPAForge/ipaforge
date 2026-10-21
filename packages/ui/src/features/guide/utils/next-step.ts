import { guideSteps } from '@ui/features/guide/constants.ts'
import type { GuideStep } from '@ui/features/guide/types.ts'

/** The step after `step`, or undefined after the last. */
export const nextStep = (step: GuideStep): GuideStep | undefined =>
  guideSteps[guideSteps.indexOf(step) + 1]

/** The step before `step`, or undefined before the first. */
export const previousStep = (step: GuideStep): GuideStep | undefined =>
  guideSteps[guideSteps.indexOf(step) - 1]

/** A saved step id as a step, the first one when it isn't (anymore) one of them. */
export const toGuideStep = (id: string): GuideStep =>
  (guideSteps as readonly string[]).includes(id) ? (id as GuideStep) : 'welcome'
