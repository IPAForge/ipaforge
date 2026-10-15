// Prompts answered through the run handle: a question waits until `answer` or `decline`, or the run is cancelled.
import type { PromptRequest } from "@installer/pipeline/step.ts";
import { ErrorCode, LoadstarError } from "@loadstar/kernel";

interface Pending {
  readonly request: PromptRequest;
  readonly resolve: (answer: unknown) => void;
  readonly reject: (error: unknown) => void;
}

export interface PromptQueue {
  /** The prompt handler for the pipeline; `onAsked` announces each question. */
  readonly ask: (request: PromptRequest, signal: AbortSignal) => Promise<unknown>;
  readonly pending: () => PromptRequest | undefined;
  readonly answer: (answer: unknown) => void;
  readonly decline: () => void;
}

const noPrompt = (): LoadstarError => new LoadstarError(ErrorCode.Unexpected, { message: "no prompt is waiting" });

export const createPromptQueue = (onAsked: (request: PromptRequest) => void): PromptQueue => {
  let current: Pending | undefined;

  const settle = (): Pending => {
    const pending = current;
    if (!pending) throw noPrompt();
    current = undefined;
    return pending;
  };

  const ask = (request: PromptRequest, signal: AbortSignal): Promise<unknown> =>
    new Promise((resolve, reject) => {
      signal.throwIfAborted();
      current = { request, resolve, reject };
      signal.addEventListener("abort", () => current?.reject(signal.reason), { once: true });
      onAsked(request);
    });

  return {
    ask,
    pending: () => current?.request,
    answer: (answer) => settle().resolve(answer),
    decline: () => settle().reject(new LoadstarError(ErrorCode.PromptCancelled)),
  };
};
