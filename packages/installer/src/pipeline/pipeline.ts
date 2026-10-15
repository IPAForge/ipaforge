// The pipeline runner every install flow uses. A flow is an ordered list of steps over one shared state object;
// the UI renders the pipeline (labels, overall progress, prompts) and never invents its own progress logic.
import { ErrorCode, LoadstarError, retry } from "@loadstar/kernel";

/** Something the user must answer before a step can continue (2FA code, team choice, certificate to revoke…). */
export interface PromptRequest {
  readonly kind: string;
  readonly data?: Readonly<Record<string, unknown>>;
}

export interface StepContext {
  readonly signal: AbortSignal;
  /** Reports progress within this step, 0–1. */
  progress(fraction: number, detail?: Readonly<Record<string, unknown>>): void;
  /** Asks the user; resolves with their answer. Throws `installer.prompt_cancelled` when they decline. */
  prompt<T = unknown>(request: PromptRequest): Promise<T>;
}

export interface Step<S> {
  /** Stable id (used for resume and diagnostics). */
  readonly id: string;
  /** i18n key for the step's label. */
  readonly labelKey: string;
  /** Relative share of the overall progress bar (default 1). */
  readonly weight?: number;
  /** Safe to run again after a transient failure (downloads, read-only requests). */
  readonly idempotent?: boolean;
  /** Skip the step when this returns true for the current state. */
  readonly skip?: (state: S) => boolean;
  /** Returns the state fields it produced (merged into the state). */
  run(state: S, context: StepContext): Promise<Partial<S> | undefined>;
}

export type PipelineEvent =
  | {
      readonly type: "step-started";
      readonly stepId: string;
      readonly labelKey: string;
      readonly index: number;
      readonly total: number;
    }
  | {
      readonly type: "step-progress";
      readonly stepId: string;
      readonly fraction: number;
      readonly detail?: Readonly<Record<string, unknown>>;
    }
  | {
      readonly type: "step-retrying";
      readonly stepId: string;
      readonly attempt: number;
      readonly delayMs: number;
      readonly code?: string;
    }
  | { readonly type: "step-skipped"; readonly stepId: string }
  | { readonly type: "step-completed"; readonly stepId: string }
  | { readonly type: "step-failed"; readonly stepId: string; readonly error: LoadstarError }
  | { readonly type: "progress"; readonly fraction: number };

/** Where to continue after a failure: completed steps are skipped, their state kept. */
export interface Checkpoint<S> {
  readonly pipelineId: string;
  readonly completed: readonly string[];
  readonly state: S;
}

export type PipelineResult<S> =
  | { readonly status: "completed"; readonly state: S }
  | {
      readonly status: "failed";
      readonly error: LoadstarError;
      readonly failedStep: string;
      readonly checkpoint: Checkpoint<S>;
    }
  | { readonly status: "cancelled"; readonly checkpoint: Checkpoint<S> };

export interface RunOptions<S> {
  readonly onEvent?: (event: PipelineEvent) => void;
  readonly onPrompt?: (request: PromptRequest, signal: AbortSignal) => Promise<unknown>;
  readonly signal?: AbortSignal;
  /** Continue from an earlier failed or cancelled run of the same pipeline. */
  readonly resume?: Checkpoint<S>;
  /** Attempts for idempotent steps on transient errors (default 3). */
  readonly attempts?: number;
  readonly sleep?: (ms: number, signal?: AbortSignal) => Promise<void>;
}

export interface Pipeline<S> {
  readonly id: string;
  readonly steps: readonly Step<S>[];
  run(initial: S, options?: RunOptions<S>): Promise<PipelineResult<S>>;
}

/** Errors worth retrying for an idempotent step: the network, rate limits, busy services, dropped devices.
 * (Catalog download errors join this list when the install flows use the catalog.) */
const TRANSIENT: ReadonlySet<string> = new Set([
  ErrorCode.Offline,
  ErrorCode.RateLimited,
  ErrorCode.AppleServiceUnavailable,
  ErrorCode.DeviceDisconnected,
  ErrorCode.DeviceTimeout,
  ErrorCode.AnisetteUnavailable,
]);

export const isTransient = (error: unknown): boolean => error instanceof LoadstarError && TRANSIENT.has(error.code);

const asLoadstarError = (error: unknown, stepId: string): LoadstarError =>
  error instanceof LoadstarError
    ? error
    : new LoadstarError(ErrorCode.StepFailed, { cause: error, data: { step: stepId } });

const isAbort = (error: unknown, signal: AbortSignal): boolean =>
  signal.aborted || (error instanceof LoadstarError && error.code === ErrorCode.Aborted);

export const pipeline = <S>(id: string, steps: readonly Step<S>[]): Pipeline<S> => {
  const ids = new Set<string>();
  for (const step of steps) {
    if (ids.has(step.id)) throw new Error(`duplicate step id "${step.id}" in pipeline "${id}"`);
    ids.add(step.id);
  }
  const totalWeight = steps.reduce((sum, step) => sum + (step.weight ?? 1), 0) || 1;

  const run = async (initial: S, options: RunOptions<S> = {}): Promise<PipelineResult<S>> => {
    const signal = options.signal ?? new AbortController().signal;
    const emit = options.onEvent ?? (() => {});
    if (options.resume && options.resume.pipelineId !== id) {
      throw new Error(`checkpoint belongs to "${options.resume.pipelineId}", not "${id}"`);
    }
    let state: S = options.resume ? options.resume.state : initial;
    const completed = new Set(options.resume?.completed ?? []);
    let done = 0;
    const checkpoint = (): Checkpoint<S> => ({ pipelineId: id, completed: [...completed], state });

    for (const [index, step] of steps.entries()) {
      const weight = step.weight ?? 1;
      if (completed.has(step.id)) {
        done += weight;
        continue;
      }
      if (signal.aborted) return { status: "cancelled", checkpoint: checkpoint() };
      if (step.skip?.(state)) {
        emit({ type: "step-skipped", stepId: step.id });
        completed.add(step.id);
        done += weight;
        emit({ type: "progress", fraction: done / totalWeight });
        continue;
      }
      emit({ type: "step-started", stepId: step.id, labelKey: step.labelKey, index, total: steps.length });
      const context: StepContext = {
        signal,
        progress: (fraction, detail) => {
          const clamped = Math.min(1, Math.max(0, fraction));
          emit({ type: "step-progress", stepId: step.id, fraction: clamped, ...(detail ? { detail } : {}) });
          emit({ type: "progress", fraction: (done + weight * clamped) / totalWeight });
        },
        prompt: async <T>(request: PromptRequest): Promise<T> => {
          if (!options.onPrompt) {
            throw new LoadstarError(ErrorCode.PromptCancelled, { message: `no prompt handler for ${request.kind}` });
          }
          return (await options.onPrompt(request, signal)) as T;
        },
      };
      try {
        const produced = await retry(() => step.run(state, context), {
          attempts: step.idempotent ? (options.attempts ?? 3) : 1,
          retryOn: (error) => isTransient(error) && !signal.aborted,
          signal,
          ...(options.sleep ? { sleep: options.sleep } : {}),
          onRetry: (error, attempt, delayMs) =>
            emit({
              type: "step-retrying",
              stepId: step.id,
              attempt,
              delayMs,
              ...(error instanceof LoadstarError ? { code: error.code } : {}),
            }),
        });
        if (produced) state = { ...state, ...produced };
      } catch (error) {
        if (isAbort(error, signal)) return { status: "cancelled", checkpoint: checkpoint() };
        const failure = asLoadstarError(error, step.id);
        emit({ type: "step-failed", stepId: step.id, error: failure });
        return { status: "failed", error: failure, failedStep: step.id, checkpoint: checkpoint() };
      }
      completed.add(step.id);
      done += weight;
      emit({ type: "step-completed", stepId: step.id });
      emit({ type: "progress", fraction: done / totalWeight });
    }
    return { status: "completed", state };
  };

  return { id, steps, run };
};
