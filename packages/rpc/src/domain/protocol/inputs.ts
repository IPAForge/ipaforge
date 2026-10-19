// Engine inputs as they cross the channel. An IPA cannot (a FileSource is a handle on the Engine's side), so the UI
// names it: a file path, a URL, or a catalog app; the server turns the first two into files through `ResolveIpa`.

import { z } from 'zod'

import { textSchema } from '@rpc/domain/protocol/common.ts'

const channelSchema = z.enum(['stable', 'nightly'])

/** Refresh or Update: the original bundle id of the installed app the IPA must be (anything else is refused). */
const replaces = textSchema.optional()

const fileIpaSchema = z.object({
  kind: z.literal('file'),
  path: textSchema,
  replaces
})

// Downloads go over HTTPS only, like the catalog's.
const urlIpaSchema = z.object({
  kind: z.literal('url'),
  url: z.url({ protocol: /^https$/ }),
  replaces
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

/** An app IPAForge installed before, signed again from its kept IPA (Refresh). */
const installedIpaSchema = z.object({
  kind: z.literal('installed'),
  bundleId: textSchema
})

export const ipaSourceSchema = z.discriminatedUnion('kind', [
  fileIpaSchema,
  urlIpaSchema,
  catalogIpaSchema,
  installedIpaSchema
])

export const installedAppsQuerySchema = z.object({
  udid: textSchema,
  teamIds: z.array(textSchema)
})

export const removeAppInputSchema = z.object({
  udid: textSchema,
  bundleId: textSchema
})

const teamId = textSchema.optional()

/** Try anyway: create App IDs though Apple's (negative) count says none are left. */
const tryAnyway = z.boolean().optional()

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
  variant: z.enum(['sidestore', 'livecontainer']),
  tryAnyway
})

export const installAppsInputSchema = z.object({
  ...accountSchema,
  teamId,
  apps: z.array(ipaSourceSchema),
  tryAnyway
})

export const refreshPlanQuerySchema = z.object({
  ...accountSchema,
  teamId,
  bundleIds: z.array(textSchema)
})

export const checkSideStoreQuerySchema = z.object({ ...accountSchema, teamId })

/** Repair SideStore: the fixes the check called for. */
export const repairSideStoreInputSchema = z.object({
  ...accountSchema,
  teamId,
  channel: channelSchema.optional(),
  bundleId: textSchema,
  reinstall: z.boolean(),
  profile: z.boolean(),
  pairing: z.boolean(),
  tryAnyway
})

/** Refresh: new profiles for the apps in `profiles`, `apps` signed and installed again. */
export const refreshAppsInputSchema = z.object({
  ...accountSchema,
  teamId,
  profiles: z.array(textSchema),
  apps: z.array(ipaSourceSchema),
  tryAnyway
})

export const placePairingInputSchema = z.object({
  ...accountSchema,
  bundleIds: z.array(textSchema).optional(),
  overwrite: z.enum(['replace', 'keep-existing']).optional()
})

/** The password and any second factor come later, as prompt answers, so they never sit in the run's input. */
export const signInInputSchema = z.object({
  appleId: textSchema,
  rememberPassword: z.boolean().optional()
})
