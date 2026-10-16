// Public API of @loadstar/installer: the Engine facade, its flows, prompts and diagnostics, and the pipeline runner.

export {
  createDeviceWatch,
  type DeviceWatch,
  type DeviceWatchEvent,
  type DeviceWatchListener
} from '@installer/application/device-watch.ts'
export {
  type InstallerDeps,
  type InstallerDepsInput,
  resolveInstallerDeps
} from '@installer/deps.ts'
export { RECOVERY_CATALOGUE } from '@installer/diagnostics/catalogue.ts'
export { classify, type Diagnosis } from '@installer/diagnostics/classify.ts'
export { RecoveryAction } from '@installer/diagnostics/recovery.ts'
export {
  DEFAULT_INSTALLER_CONFIG,
  type InstallerConfig
} from '@installer/domain/config.ts'
export {
  type FreeProfileApp,
  type FreeProfileRules,
  freeProfileBundleIds,
  isFreeProfile,
  needsFreeSlot,
  occupiedFreeSlots,
  type ProfileFacts
} from '@installer/domain/free-apps.ts'
export { StepLabel } from '@installer/domain/labels.ts'
export type {
  IpaSigner,
  SignRequest
} from '@installer/domain/ports/ipa-signer.ts'
export type { ScratchStore } from '@installer/domain/ports/scratch-store.ts'
export {
  type CertificateChoice,
  type PairingAppChoice,
  type PromptAnswer,
  type PromptData,
  PromptKind,
  type Prompts,
  type RemovableApp
} from '@installer/domain/prompts.ts'
export type {
  AccountState,
  AppJob,
  AppSource,
  DeviceSummary,
  InstallState
} from '@installer/domain/state.ts'
export type {
  CertificateStatus,
  InstallPlan,
  PlanInstallInput
} from '@installer/engine/plan.ts'
export type {
  AppIdUsage,
  EngineQueries,
  TeamCertificates,
  TeamQuery
} from '@installer/engine/queries.ts'
export type {
  CommandOptions,
  RunEvent,
  RunHandle
} from '@installer/engine/run-handle.ts'
export { createEngine, type Engine } from '@installer/engine.ts'
export {
  INSTALL_APPS,
  type InstallAppsInput
} from '@installer/flows/install-apps.ts'
export {
  INSTALL_SIDESTORE,
  type InstallSideStoreInput,
  type SideStoreVariant
} from '@installer/flows/install-sidestore.ts'
export {
  type PairingOverwrite,
  type PairingState,
  PLACE_PAIRING,
  type PlacePairingInput
} from '@installer/flows/place-pairing.ts'
export {
  SIGN_IN,
  type SignInFlowInput,
  type SignInState
} from '@installer/flows/sign-in.ts'
export { isTransient } from '@installer/pipeline/errors.ts'
export type {
  PipelineEvent,
  PlannedStep
} from '@installer/pipeline/events.ts'
export { type Pipeline, pipeline } from '@installer/pipeline/pipeline.ts'
export type { Checkpoint, PipelineResult } from '@installer/pipeline/result.ts'
export type { RunOptions } from '@installer/pipeline/run.ts'
export type {
  PromptRequest,
  Step,
  StepContext
} from '@installer/pipeline/step.ts'
export type { PromptHandler } from '@installer/pipeline/step-context.ts'
export {
  type SideStoreCertificate,
  sideStoreCertificateAdditions
} from '@installer/sidestore/certificate.ts'
export type { CertificateTrust } from '@installer/sidestore/trust.ts'
