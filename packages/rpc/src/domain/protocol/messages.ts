// What the Engine side sends: the response to each request, and each run's events and outcome.

import { z } from 'zod'

import {
  idSchema,
  recordSchema,
  serializedErrorSchema,
  versionSchema
} from '@rpc/domain/protocol/common.ts'
import { logEventSchema } from '@rpc/domain/protocol/logs.ts'
import { deviceWatchEventSchema } from '@rpc/domain/protocol/subscriptions.ts'

const stepId = z.string()

const count = z.number().int().nonnegative()

const detail = <K extends string, S extends z.ZodRawShape>(kind: K, shape: S) =>
  z.object({ kind: z.literal(kind), ...shape })

/** What a step did (the installer's `StepDetail`), every field checked. */
export const stepDetailSchema = z.discriminatedUnion('kind', [
  detail('device', {
    productType: z.string(),
    iosVersion: z.string(),
    connection: z.enum(['usb', 'network'])
  }),
  detail('release', {
    version: z.string(),
    channel: z.enum(['stable', 'nightly'])
  }),
  detail('download', { bytes: count, cached: z.boolean() }),
  detail('app', {
    name: z.string(),
    version: z.string().optional(),
    extensions: count
  }),
  detail('session', { how: z.enum(['reused', 'renewed', 'signed-in']) }),
  detail('team', { name: z.string(), isFree: z.boolean() }),
  detail('device-registration', { isNew: z.boolean() }),
  detail('certificate', { how: z.enum(['reused', 'created', 'replaced']) }),
  detail('app-ids', { created: count, reused: count, left: count }),
  detail('free-apps', {
    used: count,
    limit: count,
    removed: z.string().optional()
  }),
  detail('profiles', { count }),
  detail('signed', { bundles: count, compressed: z.boolean() }),
  detail('install-phase', { phase: z.enum(['uploading', 'installing']) }),
  detail('pairing', { apps: z.array(z.string()) }),
  detail('certificate-shared', { isShared: z.boolean() })
])

export const pipelineEventSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('run-started'),
    pipelineId: z.string(),
    steps: z.array(z.object({ stepId, labelKey: z.string() })),
    completed: z.array(stepId),
    fraction: z.number()
  }),
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
  z.object({
    type: z.literal('step-detail'),
    stepId,
    detail: stepDetailSchema
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

export const runResultSchema = z.discriminatedUnion('status', [
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
  message('run-error', { runId: idSchema, error: serializedErrorSchema }),
  message('subscription-event', {
    subscriptionId: idSchema,
    event: z.union([deviceWatchEventSchema, logEventSchema])
  })
])
