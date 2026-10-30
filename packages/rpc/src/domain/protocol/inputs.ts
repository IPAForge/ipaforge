// Engine inputs as they cross the channel. An IPA cannot (a FileSource is a handle on the Engine's side), so the UI
// names it: a file path, a URL, or a catalog app; the server turns the first two into files through `ResolveIpa`.

import { z } from 'zod'

import { textSchema } from '@rpc/domain/protocol/common.ts'

const channelSchema = z.enum(['stable', 'nightly'])

/** Refresh or Update: the original bundle id of the installed app the IPA must be (anything else is refused). */
const replaces = textSchema.optional()

/** Refresh: the installed version, which a refresh never changes. */
const version = textSchema.max(128).optional()

const fileIpaSchema = z.object({
  kind: z.literal('file'),
  path: textSchema,
  replaces
})

// Downloads go over HTTPS only, like the catalog's.
const urlIpaSchema = z.object({
  kind: z.literal('url'),
  url: z.url({ protocol: /^https$/ }),
  replaces,
  version
})

const catalogIpaSchema = z.object({
  kind: z.literal('catalog'),
  appId: textSchema,
  channel: channelSchema.optional(),
  version
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

export const pairingTargetQuerySchema = installedAppsQuerySchema.extend({
  bundleId: textSchema.max(256)
})

/** The Engine checks the path again (Documents or Library, a pairing file's name). */
export const placeAppPairingInputSchema = pairingTargetQuerySchema.extend({
  path: textSchema.max(200).optional()
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
  tryAnyway,
  /** Save signed .ipa instead: the apps (by position) to save in a folder the host's dialog gave an id to. */
  save: z
    .object({
      folderId: textSchema.max(64),
      apps: z.array(z.number().int().nonnegative().max(999)).max(100)
    })
    .optional()
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

const MAX_SERVER_NAME_LENGTH = 80

/** An anisette server's address: http allowed, for a server the user runs themselves. */
export const anisetteAddressSchema = z.url({ protocol: /^https?$/ })

const anisetteServerSchema = z.object({
  name: textSchema.max(MAX_SERVER_NAME_LENGTH),
  address: anisetteAddressSchema
})

/** A server the user adds or edits; the Engine checks the name and address again. */
export const anisetteServerInputSchema = z.object({
  name: z.string().max(MAX_SERVER_NAME_LENGTH),
  address: z.string().max(2048)
})

export const anisetteChoiceSchema = z.discriminatedUnion('mode', [
  z.object({ mode: z.literal('automatic') }),
  z.object({
    mode: z.literal('chosen'),
    server: anisetteServerSchema.optional()
  })
])

/** An Apple TV or Vision Pro showing its pairing screen, as the search found it. */
export const pairableDeviceSchema = z.object({
  id: textSchema.max(512),
  name: textSchema.max(256),
  model: textSchema.max(128).optional(),
  address: textSchema.max(64),
  port: z.number().int().min(1).max(65_535)
})

/** The code comes later, as a prompt answer, once the device shows it. */
export const pairByCodeInputSchema = z.object({ target: pairableDeviceSchema })

/** The password and any second factor come later, as prompt answers, so they never sit in the run's input. */
export const signInInputSchema = z.object({
  appleId: textSchema,
  rememberPassword: z.boolean().optional(),
  accountId: textSchema.optional()
})
