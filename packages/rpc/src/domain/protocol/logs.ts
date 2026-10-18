// The log viewer's messages: a page of the Engine's log buffer, the level it records, records the UI writes into
// it, and each new entry as a subscription event. Search and filters run in the Engine, next to the buffer.
import { z } from 'zod'

import { LOG_PAGE_MAX } from '@loadstar/kernel'
import { recordSchema } from '@rpc/domain/protocol/common.ts'

const MAX_SEARCH_LENGTH = 200
const MAX_SCOPES = 32
const MAX_MESSAGE_LENGTH = 2000

export const logLevelSchema = z.enum(['debug', 'info', 'warn', 'error'])

const seqSchema = z.number().int().nonnegative()

/** A record as a logger writes it; the UI sends its own this way. */
export const logRecordSchema = z.object({
  ts: z.iso.datetime(),
  level: logLevelSchema,
  scope: z.string().max(128).optional(),
  msg: z.string().max(MAX_MESSAGE_LENGTH),
  fields: recordSchema
})

export const logEntrySchema = logRecordSchema.extend({ seq: seqSchema })

export const logPageQuerySchema = z.object({
  minLevel: logLevelSchema.optional(),
  scopes: z
    .array(z.string().min(1).max(128))
    .max(MAX_SCOPES)
    .readonly()
    .optional(),
  text: z.string().max(MAX_SEARCH_LENGTH).optional(),
  from: z.iso.datetime().optional(),
  to: z.iso.datetime().optional(),
  after: seqSchema.optional(),
  before: seqSchema.optional(),
  limit: z.number().int().min(1).max(LOG_PAGE_MAX).optional()
})

export const logEventSchema = z.object({
  type: z.literal('log'),
  entry: logEntrySchema
})
