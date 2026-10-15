// The pipeline runner every install flow uses. A flow is an ordered list of steps over one shared state object;
// the UI renders the pipeline (labels, overall progress, prompts) and never invents its own progress logic.
import { totalWeight } from "@installer/pipeline/progress.ts";
import type { PipelineResult } from "@installer/pipeline/result.ts";
import { type RunOptions, runPipeline } from "@installer/pipeline/run.ts";
import type { Step } from "@installer/pipeline/step.ts";

export interface Pipeline<S> {
  readonly id: string;
  readonly steps: readonly Step<S>[];
  run(initial: S, options?: RunOptions<S>): Promise<PipelineResult<S>>;
}

const assertUniqueStepIds = <S>(id: string, steps: readonly Step<S>[]): void => {
  const ids = new Set<string>();
  for (const step of steps) {
    if (ids.has(step.id)) throw new Error(`duplicate step id "${step.id}" in pipeline "${id}"`);
    ids.add(step.id);
  }
};

export const pipeline = <S>(id: string, steps: readonly Step<S>[]): Pipeline<S> => {
  assertUniqueStepIds(id, steps);
  const definition = { id, steps, totalWeight: totalWeight(steps) };
  return { id, steps, run: (initial, options = {}) => runPipeline(definition, initial, options) };
};
