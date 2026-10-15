// What the Engine side sends: the response to each request, and each run's events and outcome.

import { z } from 'zod'

import {
  idSchema,
  recordSchema,
  serializedErrorSchema,
  versionSchema
} from '@rpc/domain/protocol/common.ts'

const stepId = z.string()

const pipelineEventSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('step-started'),
    stepId,
    labelKey: z.string(),
    index: z.number().int(),
    total: z.number().int()
  }),
  z.object({
    type: z.literal('step-progress'),
    stepId,
    fraction: z.number(),
    detail: recordSchema.optional()
  }),
  z.object({
    type: z.literal('step-retrying'),
    stepId,
    attempt: z.number().int(),
    delayMs: z.number(),
    code: z.string().optional()
  }),
  z.object({ type: z.literal('step-skipped'), stepId }),
  z.object({ type: z.literal('step-completed'), stepId }),
  z.object({
    type: z.literal('step-failed'),
    stepId,
    error: serializedErrorSchema
  }),
  z.object({ type: z.literal('progress'), fraction: z.number() }),
  z.object({
    type: z.literal('prompt'),
    request: z.object({ kind: z.string(), data: recordSchema.optional() })
  })
])

/** A checkpoint stays with the server (its state holds files); the UI gets a reference to resume from. */
export const remoteCheckpointSchema = z.object({
  id: idSchema,
  pipelineId: z.string(),
  completed: z.array(z.string())
})

const runResultSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('completed'), state: z.unknown() }),
  z.object({
    status: z.literal('failed'),
    error: serializedErrorSchema,
    failedStep: z.string(),
    checkpoint: remoteCheckpointSchema
  }),
  z.object({
    status: z.literal('cancelled'),
    checkpoint: remoteCheckpointSchema
  })
])

const message = <T extends string, S extends z.ZodRawShape>(
  type: T,
  shape: S
) => z.object({ v: versionSchema, type: z.literal(type), ...shape })

export const messageSchema = z.discriminatedUnion('type', [
  message('response', { id: idSchema, value: z.unknown() }),
  message('error', { id: idSchema, error: serializedErrorSchema }),
  message('run-event', { runId: idSchema, event: pipelineEventSchema }),
  message('run-result', { runId: idSchema, result: runResultSchema }),
  /** The run could not finish normally (it threw instead of returning a result). */
  message('run-error', { runId: idSchema, error: serializedErrorSchema })
])

export type WireRunEvent = z.infer<typeof pipelineEventSchema>
export type WireRunResult = z.infer<typeof runResultSchema>
export type RemoteCheckpoint = z.infer<typeof remoteCheckpointSchema>
export type Message = z.infer<typeof messageSchema>
/** A message as the server writes it; the version is added when it is sent. */
export type MessageBody = Message extends infer M
  ? M extends unknown
    ? Omit<M, 'v'>
    : never
  : never
