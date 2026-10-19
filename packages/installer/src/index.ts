// Public API of @ipaforge/installer: the Engine facade, its flows, prompts and diagnostics, and the pipeline runner.

export { createDeviceWatch } from '@installer/application/device-watch.ts'
export type { CheckSideStoreQuery } from '@installer/application/installed/check-sidestore.ts'
export type { RefreshPlanQuery } from '@installer/application/installed/refresh-plan.ts'
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
export type { InstalledStore } from '@installer/domain/ports/installed-store.ts'
export type { KeptIpaStore } from '@installer/domain/ports/kept-ipa-store.ts'
export type { ScratchStore } from '@installer/domain/ports/scratch-store.ts'
export type { IpaSigner, SignRequest } from '@installer/domain/ports/types.ts'
export { PromptKind } from '@installer/domain/prompts.ts'
export type {
  AccountState,
  AppJob,
  AppMarker,
  AppOrigin,
  AppSource,
  CertificateChoice,
  DeviceSummary,
  FreeProfileApp,
  FreeProfileRules,
  InstalledApp,
  InstalledRecord,
  InstallState,
  PairingAppChoice,
  ProfileFacts,
  PromptAnswer,
  PromptData,
  Prompts,
  RefreshDecision,
  RemovableApp,
  SideStoreCheck,
  SideStoreHealth,
  SideStoreSigner,
  TwoFactorCodeAnswer
} from '@installer/domain/types.ts'
export { logRunEvent, logRunResult } from '@installer/engine/run-log.ts'
export type {
  AppIdUsage,
  CertificateStatus,
  CommandOptions,
  EngineQueries,
  InstalledAppsQuery,
  InstallPlan,
  PlanInstallInput,
  RemoveAppInput,
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
export {
  REFRESH_APPS,
  type RefreshAppsInput
} from '@installer/flows/refresh-apps.ts'
export {
  REPAIR_SIDESTORE,
  type RepairSideStoreInput
} from '@installer/flows/repair-sidestore.ts'
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
