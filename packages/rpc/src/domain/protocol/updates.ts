// The update channel's messages, next to the Engine's: the host's update state, sent now and on every change, and
// the UI's one request, Try again after a failed update.
import { z } from 'zod'

const MAX_VERSION_LENGTH = 64
const MAX_REASON_LENGTH = 2000
const MAX_FILE_NAME_LENGTH = 256

/** What the UI sends to try a failed update again. */
export const UPDATE_RETRY = 'retry'

const versionSchema = z.string().min(1).max(MAX_VERSION_LENGTH)
const bytesSchema = z.number().nonnegative()
const linkSchema = z.url({ protocol: /^https$/ })

/** An installer that can't update the copy it installed: the user downloads the new version and installs it over. */
export const manualPackageSchema = z.enum(['msi', 'deb', 'rpm', 'other'])

/**
 * Where updating IPAForge is, as the host reports it on every launch. Until it is `idle` (or the user goes on after
 * a failure) the app waits behind the update screen.
 */
export const updateStateSchema = z.discriminatedUnion('phase', [
  // Nothing to do: up to date, offline, or no updater (a browser, a development build). `nativeBuild`: this is
  // the Intel build running translated on Apple silicon (slow), and where the Apple silicon one is.
  z.object({
    phase: z.literal('idle'),
    nativeBuild: z.object({ url: linkSchema }).optional()
  }),
  z.object({ phase: z.literal('checking') }),
  // Bytes so far and in all (0 until the first progress report).
  z.object({
    phase: z.literal('downloading'),
    version: versionSchema,
    transferred: bytesSchema,
    total: bytesSchema,
    bytesPerSecond: bytesSchema
  }),
  // Downloaded: IPAForge quits, installs it and opens again.
  z.object({ phase: z.literal('installing'), version: versionSchema }),
  // The updater's own words in `reason`; `url` is the release's page, to download it by hand.
  z.object({
    phase: z.literal('failed'),
    version: versionSchema,
    reason: z.string().max(MAX_REASON_LENGTH),
    url: linkSchema
  }),
  // A newer version is out but this copy can't install it itself: the file for this system (when IPAForge knows
  // which one it is) and where it is, else the release's page.
  z.object({
    phase: z.literal('manual'),
    version: versionSchema,
    packageType: manualPackageSchema,
    fileName: z.string().min(1).max(MAX_FILE_NAME_LENGTH).optional(),
    url: linkSchema
  })
])

export const updateRequestSchema = z.literal(UPDATE_RETRY)
