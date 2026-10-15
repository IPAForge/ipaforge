// Runs one step, retrying an idempotent step on transient errors.
import { isTransient } from "@installer/pipeline/errors.ts";
import type { EmitEvent } from "@installer/pipeline/events.ts";
import type { Step, StepContext } from "@installer/pipeline/step.ts";
import { compact, LoadstarError, retry } from "@loadstar/kernel";

/** Attempts for an idempotent step when the caller doesn't say. */
const DEFAULT_ATTEMPTS = 3;

export interface AttemptOptions {
  readonly emit: EmitEvent;
  readonly attempts: number | undefined;
  readonly sleep: ((ms: number, signal?: AbortSignal) => Promise<void>) | undefined;
}

const reportRetry =
  <S>(step: Step<S>, emit: EmitEvent) =>
  (error: unknown, attempt: number, delayMs: number): void =>
    emit(
      compact({
        type: "step-retrying" as const,
        stepId: step.id,
        attempt,
        delayMs,
        code: error instanceof LoadstarError ? error.code : undefined,
      }),
    );

export const attemptStep = <S>(
  step: Step<S>,
  state: S,
  context: StepContext,
  { emit, attempts, sleep }: AttemptOptions,
): Promise<Partial<S> | undefined> =>
  retry(
    () => step.run(state, context),
    compact({
      attempts: step.idempotent ? (attempts ?? DEFAULT_ATTEMPTS) : 1,
      retryOn: (error: unknown) => isTransient(error) && !context.signal.aborted,
      signal: context.signal,
      sleep,
      onRetry: reportRetry(step, emit),
    }),
  );
