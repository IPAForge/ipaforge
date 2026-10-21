// What the UI sends: requests, each with an id the response echoes. Queries and command starts mirror the Engine;
// answer, decline and cancel address a run by the id the client chose when it started it.

import { z } from 'zod'

import {
  idSchema,
  textSchema,
  versionSchema
} from '@rpc/domain/protocol/common.ts'
import {
  anisetteAddressSchema,
  anisetteChoiceSchema,
  anisetteServerInputSchema,
  checkSideStoreQuerySchema,
  installAppsInputSchema,
  installedAppsQuerySchema,
  installSideStoreInputSchema,
  pairingTargetQuerySchema,
  placeAppPairingInputSchema,
  placePairingInputSchema,
  planInstallInputSchema,
  refreshAppsInputSchema,
  refreshPlanQuerySchema,
  removeAppInputSchema,
  repairSideStoreInputSchema,
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

/** A .p12's password: anything typed, up to a length no one types. */
const p12PasswordSchema = z.string().min(1).max(256)

/** A .p12 file's bytes: a certificate and key are a few kilobytes, so anything far bigger isn't one. */
const p12BytesSchema = z
  .instanceof(Uint8Array)
  .refine((bytes) => bytes.byteLength > 0 && bytes.byteLength <= 256 * 1024, {
    message: 'not a .p12 size'
  })

export const queryCallSchema = z.discriminatedUnion('method', [
  call('listDevices', z.tuple([])),
  call('deviceStatus', z.tuple([textSchema])),
  call('deviceApps', z.tuple([textSchema])),
  /** Not a read: makes the Developer Mode switch appear in the device's Settings. */
  call('revealDeveloperMode', z.tuple([textSchema])),
  /** Waits for the Trust tap on the device, so it can take as long as the user does. */
  call('pairDevice', z.tuple([textSchema])),
  call('listAccounts', z.tuple([])),
  call('canSaveAccounts', z.tuple([])),
  call('listTeams', z.tuple([textSchema])),
  call('catalogApps', z.tuple([])),
  /** Looks each channel's release up on GitHub, so it answers as slowly as GitHub does. */
  call('catalogReleases', z.tuple([textSchema])),
  call('recommendedChannel', z.tuple([textSchema, textSchema.optional()])),
  call('appIdQuota', z.tuple([teamQuerySchema])),
  call('listCertificates', z.tuple([teamQuerySchema])),
  call('planInstall', z.tuple([planInstallInputSchema])),
  call('listSources', z.tuple([])),
  call('sourceApps', z.tuple([])),
  /** Sources are read over https only, like downloads. */
  call('checkSource', z.tuple([z.url({ protocol: /^https$/ })])),
  call('addSource', z.tuple([z.url({ protocol: /^https$/ })])),
  call('removeSource', z.tuple([textSchema])),
  call('setSourceEnabled', z.tuple([textSchema, z.boolean()])),
  call('refreshSources', z.tuple([textSchema.optional()])),
  call('installedApps', z.tuple([installedAppsQuerySchema])),
  call('removeApp', z.tuple([removeAppInputSchema])),
  /** Asks Apple for the team's certificates, so it answers as slowly as Apple does. */
  call('refreshPlan', z.tuple([refreshPlanQuerySchema])),
  /** Asks Apple for the team's certificates and reads SideStore's files on the device. */
  call('checkSideStore', z.tuple([checkSideStoreQuerySchema])),
  /** Not a read, but a one-shot call answered like one. */
  call('signOut', z.tuple([textSchema])),
  /** Fetches SideStore's list when it is old, so it can take a few seconds. */
  call('anisetteServers', z.tuple([])),
  call('chooseAnisetteServer', z.tuple([anisetteChoiceSchema])),
  call('addAnisetteServer', z.tuple([anisetteServerInputSchema])),
  call(
    'updateAnisetteServer',
    z.tuple([anisetteAddressSchema, anisetteServerInputSchema])
  ),
  call('removeAnisetteServer', z.tuple([anisetteAddressSchema])),
  /** Waits for the server's answer, up to the health check's timeout. */
  call('testAnisetteServer', z.tuple([z.string().min(1).max(2048)])),
  call('updateAnisetteServerList', z.tuple([])),
  call('revokeCertificate', z.tuple([teamQuerySchema, textSchema.max(128)])),
  call('deleteAppId', z.tuple([teamQuerySchema, textSchema.max(128)])),
  call('appGroups', z.tuple([teamQuerySchema])),
  call('registeredDevices', z.tuple([teamQuerySchema])),
  /** Opens the device and reads its profiles and apps. */
  call('deviceProfiles', z.tuple([textSchema])),
  call(
    'removeDeviceProfiles',
    z.tuple([textSchema, z.array(textSchema.max(128)).max(500)])
  ),
  /** Opens the device and reads each pairing app's files. */
  call('pairingFiles', z.tuple([installedAppsQuerySchema])),
  call('placeAppPairing', z.tuple([placeAppPairingInputSchema])),
  call('removeAppPairing', z.tuple([pairingTargetQuerySchema])),
  /** May wait for Trust this computer on the device. */
  call('newRemotePairing', z.tuple([installedAppsQuerySchema])),
  call('devicePairingFile', z.tuple([textSchema])),
  /** Asks Apple for the team, then packs this computer's certificate and key under the password. */
  call('exportCertificate', z.tuple([teamQuerySchema, p12PasswordSchema])),
  /** Asks Apple for the team's certificates before keeping the .p12's. */
  call(
    'importCertificate',
    z.tuple([teamQuerySchema, p12BytesSchema, p12PasswordSchema])
  )
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
    command: z.literal('refreshApps'),
    input: refreshAppsInputSchema
  }),
  z.object({
    command: z.literal('repairSideStore'),
    input: repairSideStoreInputSchema
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
  request('choose-ipas', {}),
  /** The host's folder dialog for Save signed .ipa instead; the answer is the folder's id and name, or null. */
  request('choose-save-folder', {})
])
