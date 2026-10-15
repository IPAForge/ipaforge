// What a pipeline is made of: steps over one shared state object, and the context each step runs with.

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

export const stepWeight = <S>(step: Step<S>): number => step.weight ?? 1;
