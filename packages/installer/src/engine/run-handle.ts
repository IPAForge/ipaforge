// Starting a flow and handing the caller a handle: events, prompts, cancellation and the result. The run owns its
// FlowRuntime and closes it (the device session) when it ends, however it ends.
import { createFlowRuntime, type FlowRuntime } from "@installer/application/runtime.ts";
import type { InstallerDeps } from "@installer/deps.ts";
import { createEventLog } from "@installer/engine/event-log.ts";
import { createPromptQueue } from "@installer/engine/prompt-queue.ts";
import type { Flow } from "@installer/flows/flow.ts";
import type { PipelineEvent } from "@installer/pipeline/events.ts";
import type { Checkpoint, PipelineResult } from "@installer/pipeline/result.ts";
import type { PromptRequest } from "@installer/pipeline/step.ts";
import type { PromptHandler } from "@installer/pipeline/step-context.ts";
import { compact } from "@loadstar/kernel";

export type RunEvent = PipelineEvent | { readonly type: "prompt"; readonly request: PromptRequest };

export interface CommandOptions<S> {
  /** Answers prompts directly; without it they arrive as `prompt` events and are answered through the handle. */
  readonly onPrompt?: PromptHandler;
  /** Continue a failed or cancelled run of the same command from its checkpoint. */
  readonly resume?: Checkpoint<S>;
  readonly signal?: AbortSignal;
}

export interface RunHandle<S> {
  /** Every event so far, then each new one; returns an unsubscribe function. */
  subscribe(listener: (event: RunEvent) => void): () => void;
  /** The question waiting for an answer (when no `onPrompt` was given). */
  pending(): PromptRequest | undefined;
  answer(answer: unknown): void;
  /** Declines the waiting question (`installer.prompt_cancelled`). */
  decline(): void;
  cancel(): void;
  /** Settles when the run ends; a failed or cancelled result carries the checkpoint to resume from. */
  readonly result: Promise<PipelineResult<S>>;
}

const linkAbort = (controller: AbortController, signal: AbortSignal | undefined): void => {
  if (signal?.aborted) controller.abort(signal.reason);
  signal?.addEventListener("abort", () => controller.abort(signal.reason), { once: true });
};

const runToEnd = async <S>(runtime: FlowRuntime, run: () => Promise<PipelineResult<S>>) => {
  try {
    return await run();
  } finally {
    await runtime.close();
  }
};

export const startRun = <S>(
  deps: InstallerDeps,
  build: (runtime: FlowRuntime) => Flow<S>,
  options: CommandOptions<S> = {},
): RunHandle<S> => {
  const runtime = createFlowRuntime(deps);
  const controller = new AbortController();
  linkAbort(controller, options.signal);
  const events = createEventLog<RunEvent>();
  const prompts = createPromptQueue((request) => events.emit({ type: "prompt", request }));
  const { pipeline, initial } = build(runtime);
  const result = runToEnd(runtime, () =>
    pipeline.run(
      initial,
      compact({
        onEvent: events.emit,
        onPrompt: options.onPrompt ?? prompts.ask,
        signal: controller.signal,
        resume: options.resume,
      }),
    ),
  );
  return {
    subscribe: events.subscribe,
    pending: prompts.pending,
    answer: prompts.answer,
    decline: prompts.decline,
    cancel: () => controller.abort(),
    result,
  };
};
