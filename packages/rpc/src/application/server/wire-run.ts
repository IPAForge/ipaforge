// A run's events and outcome in wire form: errors serialized, file handles dropped, checkpoints kept server-side.
import type { PipelineResult, RunEvent } from "@loadstar/installer";
import type { CheckpointStore } from "@rpc/application/server/checkpoints.ts";
import type { WireRunEvent, WireRunResult } from "@rpc/domain/protocol/messages.ts";
import type { Command } from "@rpc/domain/protocol/requests.ts";
import { toWire } from "@rpc/domain/wire.ts";

export const wireEvent = (event: RunEvent): WireRunEvent =>
  event.type === "step-failed" ? { ...event, error: event.error.toJSON() } : (toWire(event) as WireRunEvent);

export const wireResult = (
  result: PipelineResult<unknown>,
  command: Command,
  checkpoints: CheckpointStore,
): WireRunResult => {
  if (result.status === "completed") return { status: result.status, state: toWire(result.state) };
  const checkpoint = checkpoints.keep(command, result.checkpoint);
  if (result.status === "cancelled") return { status: result.status, checkpoint };
  return { status: result.status, error: result.error.toJSON(), failedStep: result.failedStep, checkpoint };
};
