// Engine inputs as they cross the channel. An IPA cannot (a FileSource is a handle on the Engine's side), so the UI
// names it: a file path, a URL, or a catalog app; the server turns the first two into files through `ResolveIpa`.

import { z } from 'zod'

import { textSchema } from '@rpc/domain/protocol/common.ts'

const channelSchema = z.enum(['stable', 'nightly'])

const fileIpaSchema = z.object({ kind: z.literal('file'), path: textSchema })

// Downloads go over HTTPS only, like the catalog's.
const urlIpaSchema = z.object({
  kind: z.literal('url'),
  url: z.url({ protocol: /^https$/ })
})

const catalogIpaSchema = z.object({
  kind: z.literal('catalog'),
  appId: textSchema,
  channel: channelSchema.optional()
})

export const externalIpaSchema = z.discriminatedUnion('kind', [
  fileIpaSchema,
  urlIpaSchema
])

export const ipaSourceSchema = z.discriminatedUnion('kind', [
  fileIpaSchema,
  urlIpaSchema,
  catalogIpaSchema
])

const teamId = textSchema.optional()

const accountSchema = { udid: textSchema, accountId: textSchema }

export const teamQuerySchema = z.object({ accountId: textSchema, teamId })

export const planInstallInputSchema = z.object({
  ...accountSchema,
  teamId,
  source: ipaSourceSchema
})

export const installSideStoreInputSchema = z.object({
  ...accountSchema,
  teamId,
  channel: channelSchema.optional(),
  variant: z.enum(['sidestore', 'livecontainer'])
})

export const installAppsInputSchema = z.object({
  ...accountSchema,
  teamId,
  apps: z.array(ipaSourceSchema)
})

export const placePairingInputSchema = z.object({
  ...accountSchema,
  bundleIds: z.array(textSchema).optional(),
  overwrite: z.enum(['replace', 'keep-existing']).optional()
})

export type ExternalIpa = z.infer<typeof externalIpaSchema>
export type IpaSource = z.input<typeof ipaSourceSchema>
export type RemotePlanInstallInput = z.input<typeof planInstallInputSchema>
export type RemoteInstallSideStoreInput = z.input<
  typeof installSideStoreInputSchema
>
export type RemoteInstallAppsInput = z.input<typeof installAppsInputSchema>
export type RemotePlacePairingInput = z.input<typeof placePairingInputSchema>
