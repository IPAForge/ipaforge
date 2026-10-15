// What a running pipeline reports to the UI.
import type { LoadstarError } from "@loadstar/kernel";

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

export type EmitEvent = (event: PipelineEvent) => void;
