// What the UI sends: requests, each with an id the response echoes. Queries and command starts mirror the Engine;
// answer, decline and cancel address a run by the id the client chose when it started it.

import { z } from 'zod'

import {
  idSchema,
  textSchema,
  versionSchema
} from '@rpc/domain/protocol/common.ts'
import {
  installAppsInputSchema,
  installSideStoreInputSchema,
  placePairingInputSchema,
  planInstallInputSchema,
  signInInputSchema,
  teamQuerySchema
} from '@rpc/domain/protocol/inputs.ts'
import {
  logLevelSchema,
  logPageQuerySchema,
  logRecordSchema
} from '@rpc/domain/protocol/logs.ts'
import { subscriptionTopicSchema } from '@rpc/domain/protocol/subscriptions.ts'

const call = <M extends string, A extends z.ZodTuple>(method: M, args: A) =>
  z.object({ method: z.literal(method), args })

export const queryCallSchema = z.discriminatedUnion('method', [
  call('listDevices', z.tuple([])),
  call('deviceStatus', z.tuple([textSchema])),
  /** Waits for the Trust tap on the device, so it can take as long as the user does. */
  call('pairDevice', z.tuple([textSchema])),
  call('listAccounts', z.tuple([])),
  call('listTeams', z.tuple([textSchema])),
  call('catalogApps', z.tuple([])),
  call('recommendedChannel', z.tuple([textSchema, textSchema.optional()])),
  call('appIdQuota', z.tuple([teamQuerySchema])),
  call('listCertificates', z.tuple([teamQuerySchema])),
  call('planInstall', z.tuple([planInstallInputSchema])),
  /** Not a read, but a one-shot call answered like one. */
  call('signOut', z.tuple([textSchema]))
])

export const commandCallSchema = z.discriminatedUnion('command', [
  z.object({
    command: z.literal('installSideStore'),
    input: installSideStoreInputSchema
  }),
  z.object({
    command: z.literal('installApps'),
    input: installAppsInputSchema
  }),
  z.object({
    command: z.literal('placePairing'),
    input: placePairingInputSchema
  }),
  z.object({ command: z.literal('signIn'), input: signInInputSchema })
])

const request = <T extends string, S extends z.ZodRawShape>(
  type: T,
  shape: S
) =>
  z.object({ v: versionSchema, id: idSchema, type: z.literal(type), ...shape })

export const requestSchema = z.discriminatedUnion('type', [
  request('query', { call: queryCallSchema }),
  /** `resume` is the id of a checkpoint the server kept from an earlier run of the same command. */
  request('start', {
    runId: idSchema,
    call: commandCallSchema,
    resume: idSchema.optional()
  }),
  request('answer', { runId: idSchema, answer: z.unknown() }),
  request('decline', { runId: idSchema }),
  request('cancel', { runId: idSchema }),
  /** Starts a live feed under an id the client picks; `unsubscribe` ends it. */
  request('subscribe', {
    subscriptionId: idSchema,
    topic: subscriptionTopicSchema
  }),
  request('unsubscribe', { subscriptionId: idSchema }),
  /** A page of the log buffer, filtered and searched on the Engine's side. */
  request('logs', { query: logPageQuerySchema }),
  /** The level the Engine records at; with `level`, changes it first. */
  request('log-level', { level: logLevelSchema.optional() }),
  /** A record the UI logged, kept with the Engine's so the viewer shows both. */
  request('log', { record: logRecordSchema }),
  /** The host's file dialog for IPAs; the answer names the files the user picked. */
  request('choose-ipas', {})
])
