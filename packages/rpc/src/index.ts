// Public API of @loadstar/rpc: the typed channel between the Engine (server) and the UI (EngineClient).

// Installer data and types the UI needs (prompt kinds, recovery actions, step labels, the Engine's shapes for a
// stand-in Engine) without importing the installer.
export {
  type AppIdUsage,
  type CertificateChoice,
  type CommandOptions,
  classify,
  type DeviceWatchEvent,
  type Diagnosis,
  type Engine,
  type InstallPlan,
  type InstallState,
  type PairingAppChoice,
  type PipelineResult,
  type PlannedStep,
  type PromptAnswer,
  type PromptData,
  PromptKind,
  type PromptRequest,
  type Prompts,
  RecoveryAction,
  type RemovableApp,
  type RunEvent,
  type RunHandle,
  type SignInState,
  StepLabel,
  type TeamCertificates,
  type TeamQuery
} from '@loadstar/installer'
export {
  createEngineClient,
  type EngineClientOptions
} from '@rpc/application/client.ts'
export {
  createRpcServer,
  type RpcServer,
  type RpcServerOptions
} from '@rpc/application/server.ts'
export { DEFAULT_RPC_CONFIG, type RpcConfig } from '@rpc/domain/config.ts'
export type {
  EngineClient,
  RemoteCommandOptions,
  RemoteResult,
  RemoteRunHandle
} from '@rpc/domain/engine-client.ts'
export type { ResolveIpa } from '@rpc/domain/ports/resolve-ipa.ts'
export type { Transport } from '@rpc/domain/ports/transport.ts'
export { PROTOCOL_VERSION } from '@rpc/domain/protocol/common.ts'
export type {
  ExternalIpa,
  IpaSource,
  RemoteInstallAppsInput,
  RemoteInstallSideStoreInput,
  RemotePlacePairingInput,
  RemotePlanInstallInput,
  RemoteSignInInput
} from '@rpc/domain/protocol/inputs.ts'
export {
  type Message,
  messageSchema,
  type RemoteCheckpoint
} from '@rpc/domain/protocol/messages.ts'
export { type Request, requestSchema } from '@rpc/domain/protocol/requests.ts'
export type { SubscriptionTopic } from '@rpc/domain/protocol/subscriptions.ts'
export type { Wire } from '@rpc/domain/wire.ts'
export { createMemoryTransportPair } from '@rpc/infrastructure/memory-transport.ts'
