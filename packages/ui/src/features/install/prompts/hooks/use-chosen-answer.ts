import { useState } from 'react'

import type { ChosenAnswer } from '@ui/features/install/prompts/types.ts'

/**
 * One-click answers: pressing one answers at once; while the Engine acts on it, that button is busy and the
 * others wait. A press while pending does nothing.
 */
export const useChosenAnswer = (
  onAnswer: (answer: unknown) => void,
  isPending: boolean
): ChosenAnswer => {
  const [chosen, setChosen] = useState<string | undefined>(undefined)

  return {
    choose: (key, answer) => () => {
      if (isPending) return
      setChosen(key)
      onAnswer(answer)
    },
    busy: (key) => ({
      isPending: isPending && chosen === key,
      isDisabled: isPending && chosen !== key
    })
  }
}
