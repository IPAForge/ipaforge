// What a pipeline is made of: steps over one shared state object, and the context each step runs with.

import type { Step } from '@installer/pipeline/types.ts'

export const stepWeight = <S>(step: Step<S>): number => step.weight ?? 1
