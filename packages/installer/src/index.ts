// Public API of @loadstar/installer: the Engine facade, its flows, prompts and diagnostics, and the pipeline runner.

export { createDeviceWatch } from '@installer/application/device-watch.ts'
export type {
  DeviceWatch,
  DeviceWatchEvent,
  DeviceWatchListener
} from '@installer/application/types.ts'
export { resolveInstallerDeps } from '@installer/deps.ts'
export { RECOVERY_CATALOGUE } from '@installer/diagnostics/catalogue.ts'
export { classify, type Diagnosis } from '@installer/diagnostics/classify.ts'
export { RecoveryAction } from '@installer/diagnostics/recovery.ts'
export {
  DEFAULT_INSTALLER_CONFIG,
  type InstallerConfig
} from '@installer/domain/config.ts'
export {
  freeProfileBundleIds,
  isFreeProfile,
  needsFreeSlot,
  occupiedFreeSlots
} from '@installer/domain/free-apps.ts'
export { StepLabel } from '@installer/domain/labels.ts'
export type { ScratchStore } from '@installer/domain/ports/scratch-store.ts'
export type { IpaSigner, SignRequest } from '@installer/domain/ports/types.ts'
export { PromptKind } from '@installer/domain/prompts.ts'
export type {
  AccountState,
  AppJob,
  AppSource,
  CertificateChoice,
  DeviceSummary,
  FreeProfileApp,
  FreeProfileRules,
  InstallState,
  PairingAppChoice,
  ProfileFacts,
  PromptAnswer,
  PromptData,
  Prompts,
  RemovableApp
} from '@installer/domain/types.ts'
export type {
  AppIdUsage,
  CertificateStatus,
  CommandOptions,
  EngineQueries,
  InstallPlan,
  PlanInstallInput,
  RunEvent,
  RunHandle,
  TeamCertificates,
  TeamQuery
} from '@installer/engine/types.ts'
export { createEngine, type Engine } from '@installer/engine.ts'
export {
  INSTALL_APPS,
  type InstallAppsInput
} from '@installer/flows/install-apps.ts'
export { INSTALL_SIDESTORE } from '@installer/flows/install-sidestore.ts'
export { PLACE_PAIRING } from '@installer/flows/place-pairing.ts'
export { SIGN_IN } from '@installer/flows/sign-in.ts'
export type {
  InstallSideStoreInput,
  PairingOverwrite,
  PairingState,
  PlacePairingInput,
  SideStoreVariant,
  SignInFlowInput,
  SignInState
} from '@installer/flows/types.ts'
export { isTransient } from '@installer/pipeline/errors.ts'
export { type Pipeline, pipeline } from '@installer/pipeline/pipeline.ts'
export type {
  Checkpoint,
  PipelineEvent,
  PipelineResult,
  PlannedStep,
  PromptHandler,
  PromptRequest,
  RunOptions,
  Step,
  StepContext,
  StepDetail
} from '@installer/pipeline/types.ts'
export {
  type SideStoreCertificate,
  sideStoreCertificateAdditions
} from '@installer/sidestore/certificate.ts'
export type { CertificateTrust } from '@installer/sidestore/trust.ts'
export type { InstallerDeps, InstallerDepsInput } from '@installer/types.ts'
