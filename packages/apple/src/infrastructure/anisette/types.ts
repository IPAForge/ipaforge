import type { z } from 'zod'

import type { socketMessageSchema } from '@apple/infrastructure/anisette/v3.ts'

export type SocketMessage = z.infer<typeof socketMessageSchema>

export type HeadersResult =
  | { readonly kind: 'headers'; readonly headers: Record<string, string> }
  | { readonly kind: 'not_provisioned'; readonly message: string }
