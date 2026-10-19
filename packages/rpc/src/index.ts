// Public API of @ipaforge/rpc: the typed channel between the Engine (server) and the UI (EngineClient).

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
  logRunEvent,
  logRunResult,
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
  type StepDetail,
  StepLabel,
  type TeamCertificates,
  type TeamQuery,
  type TwoFactorCodeAnswer
} from '@ipaforge/installer'
export { createEngineClient } from '@rpc/application/client.ts'
export { createRpcServer } from '@rpc/application/server.ts'
export type {
  EngineClientOptions,
  RpcServer,
  RpcServerOptions
} from '@rpc/application/types.ts'
export { DEFAULT_RPC_CONFIG, type RpcConfig } from '@rpc/domain/config.ts'
export type { ChooseIpas } from '@rpc/domain/ports/choose-ipas.ts'
export type { LogSource } from '@rpc/domain/ports/log-source.ts'
export type { ResolveIpa } from '@rpc/domain/ports/resolve-ipa.ts'
export type { Transport } from '@rpc/domain/ports/transport.ts'
export { PROTOCOL_VERSION } from '@rpc/domain/protocol/common.ts'
export { messageSchema } from '@rpc/domain/protocol/messages.ts'
export { requestSchema } from '@rpc/domain/protocol/requests.ts'
export type {
  ExternalIpa,
  IpaSource,
  Message,
  RemoteCheckpoint,
  RemoteInstallAppsInput,
  RemoteInstallSideStoreInput,
  RemotePlacePairingInput,
  RemotePlanInstallInput,
  RemoteRefreshAppsInput,
  RemoteRepairSideStoreInput,
  RemoteSignInInput,
  Request,
  SubscriptionTopic
} from '@rpc/domain/protocol/types.ts'
export type {
  ChosenIpa,
  EngineClient,
  EngineLogs,
  RemoteCommandOptions,
  RemoteResult,
  RemoteRunHandle,
  Wire
} from '@rpc/domain/types.ts'
export { createMemoryTransportPair } from '@rpc/infrastructure/memory-transport.ts'
