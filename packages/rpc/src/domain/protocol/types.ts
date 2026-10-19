import type { z } from 'zod'

import type {
  externalIpaSchema,
  installAppsInputSchema,
  installSideStoreInputSchema,
  ipaSourceSchema,
  placePairingInputSchema,
  planInstallInputSchema,
  refreshAppsInputSchema,
  signInInputSchema
} from '@rpc/domain/protocol/inputs.ts'
import type {
  logEntrySchema,
  logEventSchema,
  logPageQuerySchema
} from '@rpc/domain/protocol/logs.ts'
import type {
  messageSchema,
  pipelineEventSchema,
  remoteCheckpointSchema,
  runResultSchema
} from '@rpc/domain/protocol/messages.ts'
import type {
  commandCallSchema,
  queryCallSchema,
  requestSchema
} from '@rpc/domain/protocol/requests.ts'
import type {
  deviceWatchEventSchema,
  subscriptionTopicSchema
} from '@rpc/domain/protocol/subscriptions.ts'

export type ExternalIpa = z.infer<typeof externalIpaSchema>

export type IpaSource = z.input<typeof ipaSourceSchema>

export type RemotePlanInstallInput = z.input<typeof planInstallInputSchema>

export type RemoteInstallSideStoreInput = z.input<
  typeof installSideStoreInputSchema
>

export type RemoteInstallAppsInput = z.input<typeof installAppsInputSchema>

export type RemoteRefreshAppsInput = z.input<typeof refreshAppsInputSchema>

export type RemotePlacePairingInput = z.input<typeof placePairingInputSchema>

export type RemoteSignInInput = z.input<typeof signInInputSchema>

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

export type QueryCall = z.infer<typeof queryCallSchema>

export type QueryMethod = QueryCall['method']

export type QueryCallInput = z.input<typeof queryCallSchema>

export type CommandCall = z.infer<typeof commandCallSchema>

export type CommandCallInput = z.input<typeof commandCallSchema>

export type Command = CommandCall['command']

export type Request = z.infer<typeof requestSchema>

/** A request as the client writes it; the version and id are added when it is sent. */
export type RequestBody =
  z.input<typeof requestSchema> extends infer R
    ? R extends unknown
      ? Omit<R, 'v' | 'id'>
      : never
    : never

export type SubscriptionTopic = z.infer<typeof subscriptionTopicSchema>

export type WireDeviceWatchEvent = z.infer<typeof deviceWatchEventSchema>

export type WireLogEntry = z.infer<typeof logEntrySchema>

export type WireLogEvent = z.infer<typeof logEventSchema>

export type WireSubscriptionEvent = WireDeviceWatchEvent | WireLogEvent

export type RemoteLogPageQuery = z.input<typeof logPageQuerySchema>
