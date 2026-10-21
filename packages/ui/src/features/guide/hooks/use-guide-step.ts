import {
  nextStep,
  previousStep,
  toGuideStep
} from '@ui/features/guide/utils/next-step.ts'
import { useGuide } from '@ui/hooks/use-guide.ts'

/** The step shown and how to move on: Continue marks it done, Skip doesn't; the last step's Continue finishes. */
export const useGuideStep = () => {
  const { guide, goTo, complete, finish, later } = useGuide()
  const step = toGuideStep(guide.step)
  const next = nextStep(step)
  const previous = previousStep(step)

  return {
    step,
    done: guide.done,
    onContinue: () => {
      complete(step, next)
      if (!next) finish()
    },
    onSkip: () => (next ? goTo(next) : finish()),
    onBack: previous ? () => goTo(previous) : undefined,
    onGoTo: goTo,
    onLater: later,
    onFinish: finish,
    isLast: next === undefined
  }
}
