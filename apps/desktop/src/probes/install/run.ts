// Runs an Engine command in the terminal: compact step progress, prompts answered here, and on failure the
// diagnosis the UI would show (code and recovery actions).
import { describeError } from "@desktop/probes/apple/describe-error.ts";
import { terminalAnswers } from "@desktop/probes/install/answers.ts";
import type { InstallProbe } from "@desktop/probes/install/context.ts";
import type { CommandOptions, PipelineResult, RunEvent, RunHandle } from "@loadstar/installer";

const PERCENT = 100;
/** Within-step progress is printed in steps of this many percent. */
const PROGRESS_STEP = 25;

/** `install.steps.sign_in` → `sign in`. */
const stepName = (labelKey: string): string => (labelKey.split(".").at(-1) ?? labelKey).replaceAll("_", " ");

const eventPrinter = () => {
  let lastPercent = 0;
  return (event: RunEvent): void => {
    if (event.type === "step-started") {
      lastPercent = 0;
      console.log(`[${event.index + 1}/${event.total}] ${stepName(event.labelKey)}`);
    } else if (event.type === "step-progress") {
      const percent = Math.floor(event.fraction * PERCENT);
      if (percent < lastPercent + PROGRESS_STEP) return;
      lastPercent = percent;
      console.log(`      ${percent}%`);
    } else if (event.type === "step-skipped") {
      console.log(`      (skipped ${event.stepId})`);
    } else if (event.type === "step-retrying") {
      console.log(`      retrying (${event.code ?? "error"}) in ${event.delayMs} ms`);
    }
  };
};

const report = <S>(probe: InstallProbe, result: PipelineResult<S>): S => {
  if (result.status === "completed") {
    console.log("✓ done");
    return result.state;
  }
  if (result.status === "cancelled") throw new Error("cancelled");
  const diagnosis = probe.engine.classify(result.error);
  console.error(`✗ step "${result.failedStep}" failed: ${describeError(result.error)}`);
  console.error(`  diagnosis: ${diagnosis.code}; recovery: ${diagnosis.recovery.join(", ")}`);
  process.exitCode = 1;
  return result.checkpoint.state;
};

/** Starts a command with terminal prompts, prints its progress and returns the final state. */
export const runCommand = async <S>(
  probe: InstallProbe,
  start: (options: CommandOptions<S>) => RunHandle<S>,
): Promise<S> => {
  const run = start({ onPrompt: terminalAnswers(probe.prompt) });
  run.subscribe(eventPrinter());
  return report(probe, await run.result);
};
