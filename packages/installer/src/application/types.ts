import type { z } from 'zod'

import type { storedSchema } from '@installer/application/certificate-store.ts'
import type { InstallerConfig } from '@installer/domain/config.ts'
import type {
  FreeProfileApp,
  FreeProfileRules,
  ProfileFacts
} from '@installer/domain/types.ts'
import type { StepDetail } from '@installer/pipeline/types.ts'
import type { AppleSession, CertificateIdentity } from '@ipaforge/apple'
import type { DeviceManager, UsbmuxDevice } from '@ipaforge/device'
import type { Logger } from '@ipaforge/kernel'

export type StoredCertificate = z.infer<typeof storedSchema>

export type CertificateStore = {
  load(
    accountId: string,
    teamId: string
  ): Promise<CertificateIdentity | undefined>
  save(
    accountId: string,
    teamId: string,
    identity: CertificateIdentity
  ): Promise<void>
}

export type DeviceWatchEvent =
  /** Every connected device (one entry per device, its USB link preferred): first, after a reconnect, after a change. */
  | { readonly type: 'devices'; readonly devices: readonly UsbmuxDevice[] }
  | { readonly type: 'attached'; readonly device: UsbmuxDevice }
  | {
      readonly type: 'detached'
      readonly deviceId: number
      readonly udid?: string
    }

export type DeviceWatchListener = (event: DeviceWatchEvent) => void

export type DeviceWatch = {
  /** Starts watching with the first listener; a late listener gets the current list at once. Returns unsubscribe. */
  subscribe(listener: DeviceWatchListener, signal?: AbortSignal): () => void
}

export type DeviceWatchDeps = {
  readonly devices: DeviceManager
  readonly config: Pick<
    InstallerConfig,
    'deviceReconnectBaseMs' | 'deviceReconnectMaxMs' | 'devicePollIntervalMs'
  >
  readonly logger: Logger
  readonly sleep?: (ms: number, signal: AbortSignal) => Promise<void>
}

export type FreeSlotRequest = {
  readonly rules: FreeProfileRules
  readonly limit: number
  /** New main bundle ID of the app about to be installed. */
  readonly installing: string
}

/** An opened saved account, and how: its saved session, a silent sign-in with the saved password, or the user's. */
export type OpenedAccount = {
  readonly session: AppleSession
  readonly how: Extract<StepDetail, { kind: 'session' }>['how']
}

/** The team's certificate, and whether it was reused, created, or created after revoking one. */
export type EnsuredCertificate = {
  readonly identity: CertificateIdentity
  readonly how: Extract<StepDetail, { kind: 'certificate' }>['how']
}

/** The free-app slots other apps hold once there is room, and the app removed to make it (name, else bundle ID). */
export type FreeSlotOutcome = {
  readonly used: number
  readonly removed?: string
}

export type FreeSlots = {
  readonly profiles: readonly ProfileFacts[]
  readonly occupied: readonly FreeProfileApp[]
}
