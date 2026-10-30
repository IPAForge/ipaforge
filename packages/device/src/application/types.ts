import type { LockdownSession } from '@device/application/lockdown.ts'
import type { PairRecord } from '@device/domain/pairing/types.ts'
import type { RemotePairingRecord } from '@device/domain/remote-pairing/types.ts'
import type { DeviceInfo, UsbmuxDevice } from '@device/domain/types.ts'
import type { Link } from '@device/infrastructure/framing/link.ts'
import type { ContainerMode } from '@device/infrastructure/house-arrest/client.ts'
import type {
  RsdService,
  XpcDictionary
} from '@device/infrastructure/rsd/types.ts'
import type { TcpStats } from '@device/infrastructure/tunnel/types.ts'
import type { PlistValue } from '@ipaforge/kernel'

export type AppFileTarget = {
  readonly bundleId: string
  /** Path inside the container, e.g. `Documents/pairingFile.plist`. */
  readonly path: string
  /** Default `documents` (works for App Store and sideloaded apps that share Documents). */
  readonly mode?: ContainerMode
}

export type AppFileStatus = {
  readonly target: AppFileTarget
  readonly exists: boolean
  readonly size?: number
  /** Last modification, when the device reports it. */
  readonly modifiedAt?: Date
}

export type DeveloperModeState = 'on' | 'off' | 'not_required' | 'unknown'

export type DeviceCheck = {
  readonly info: DeviceInfo
  /** The screen is locked right now (pairing and some services wait for an unlock). */
  readonly locked: boolean
  readonly developerMode: DeveloperModeState
  readonly activated: boolean
}

export type InstallStage = 'uploading' | 'installing' | 'done'

export type InstallIpaProgress = {
  readonly stage: InstallStage
  /** 0–100 across the whole install (upload is the first half). */
  readonly percent: number
  /** 0–100 within the current stage: the upload's bytes, or installd's own percent. */
  readonly stagePercent: number
  /** installd's phase (`VerifyingApplication`, `InstallingApplication`…). */
  readonly status?: string
  /** While uploading: bytes sent so far, and the IPA's size. */
  readonly sent?: number
  readonly total?: number
}

export type InstallIpaOptions = {
  /** Replace an existing app with the same bundle ID, keeping its data. Default true. */
  readonly upgrade?: boolean
  readonly onProgress?: (progress: InstallIpaProgress) => void
  readonly signal?: AbortSignal
  /**
   * How long the device may stay silent while it installs (it reports progress every few seconds) before the install
   * fails with `device.timeout`: a locked device can stop answering. Default 90 seconds.
   */
  readonly idleTimeoutMs?: number
}

export type Report = (progress: InstallIpaProgress) => void

export type PairingProgress =
  | { readonly stage: 'waiting_for_trust' }
  | { readonly stage: 'waiting_for_unlock' }
  | { readonly stage: 'paired'; readonly savedTo: PairRecordStore }

/**
 * `os`: wait for the pair record the OS creates when the user taps Trust, and pair on our own only if none
 * appears within `osPairingTimeoutMs`. `own`: pair on our own straight away.
 */
export type PairMethod = 'os' | 'own'

export type PairOptions = {
  /** Default `"os"`. */
  readonly method?: PairMethod
  readonly onProgress?: (event: PairingProgress) => void
  readonly signal?: AbortSignal
}

/** Where a pair record comes from: the OS's usbmuxd, or IPAForge's own secret store. */
export type PairRecordStore = 'usbmuxd' | 'secret_store'

/** A pair record and where it was found. */
export type StoredPairRecord = {
  readonly record: PairRecord
  readonly source: PairRecordStore
}

/** A pairing-file location, with the app it belongs to (for the confirmation shown to the user). */
export type PairingTarget = AppFileTarget & {
  readonly appName: string
}

export type PlacePairingOptions = {
  /**
   * Turn on Wi-Fi debugging first (default true). On-device tools (SideStore, StikDebug) reach lockdownd over
   * Wi-Fi/VPN with this file, which only works once it is enabled; it fails without a passcode.
   */
  readonly enableWifiDebugging?: boolean
  /**
   * Also give SideStore its remote pairing on iOS 17.4 and later (default true): made or reused, then written to
   * the app's remote pairing file next to the classic one.
   */
  readonly remotePairing?: boolean
  /** Making the remote pairing shows the Trust prompt and waits for the user. */
  readonly onAwaitingConsent?: () => void
  /** Make a new remote pairing even when the saved one is still accepted (the old one stops working). */
  readonly newRemotePairing?: boolean
}

/** What placing the pairing file wrote: the classic files, and the remote ones with how the pairing came about. */
export type PlacedPairing = {
  readonly classic: readonly AppFileTarget[]
  readonly remote: readonly AppFileTarget[]
  /** Reused (still accepted) or made now; absent when no remote pairing was written. */
  readonly remoteHow?: RemotePairingResult['how']
}

export type OpenSessionOptions = PairOptions & {
  /** Pair automatically (trust prompt) when there is no usable pair record. Default true. */
  readonly autoPair?: boolean
  /**
   * `wifi`: only straight over Wi-Fi, skipping the cable and usbmuxd (maintainer probes). `tunnel`: the best link,
   * with every service that has a counterpart in the iOS 17.4+ tunnel opened through it. Default: the best link,
   * with the tunnel only as a fallback for services lockdown won't start.
   */
  readonly route?: 'best' | 'wifi' | 'tunnel' | 'wifi-tunnel'
}

export type StartServiceOptions = {
  /** Send the pair record's escrow bag (needed by some services while the device is locked). */
  readonly escrowBag?: boolean
}

/** An open lockdown session with one device. Close it when done. */
export type DeviceSession = {
  readonly device: UsbmuxDevice
  /** The classic pairing; a device paired by code (Apple TV, Vision Pro) has none. */
  readonly pairRecord?: PairRecord | undefined
  info(): Promise<DeviceInfo>
  getValue(key?: string, domain?: string): Promise<PlistValue | undefined>
  setValue(domain: string, key: string, value: PlistValue): Promise<void>
  /** Starts `service` and returns a new connection to it (TLS when the device asks for it). */
  startService(service: string, options?: StartServiceOptions): Promise<Link>
  /**
   * The device's iOS 17.4+ tunnel, opened on first use over this session's link and closed with the session.
   * Throws `device.tunnel_unavailable` when the device can't open one (before iOS 17.4).
   */
  tunnel(): Promise<DeviceTunnel>
  /**
   * Lets the device be reached over Wi-Fi/VPN (SideStore and StikDebug use the pairing file this way).
   * lockdownd answers `MissingValue` when no passcode is set → `device.passcode_required`.
   */
  enableWifiDebugging(): Promise<void>
  close(): Promise<void>
}

export type StartedSession = LockdownSession & {
  readonly pairRecord: PairRecord
}

/** Making or reusing the remote pairing (iOS 17.4 and later). */
export type RemotePairingOptions = {
  /** The device shows a prompt (Trust this computer) and waits for the user. */
  readonly onAwaitingConsent?: () => void
  /** Make a new one even when the saved one is still accepted. */
  readonly forceNew?: boolean
}

/** The remote pairing to give SideStore, and whether it was reused (still accepted) or made now. */
export type RemotePairingResult = {
  readonly record: RemotePairingRecord
  readonly how: 'verified' | 'created'
}

/** Whether the device accepts this computer's saved remote pairing, and that pairing's identifier when there is one. */
export type RemotePairingState =
  | { readonly state: 'accepted' | 'rejected'; readonly identifier: string }
  | { readonly state: 'missing' }

/**
 * The iOS 17.4+ device tunnel: CoreDeviceProxy's packet tunnel with IPAForge's own TCP inside, and the services the
 * device's RSD lists there. Lockdown services have a counterpart (`<service>.shim.remote`) that speaks the same
 * protocol without TLS once checked in.
 */
export type DeviceTunnel = {
  /** The largest packet IPAForge sends through it. */
  readonly mtu: number
  readonly services: ReadonlyMap<string, RsdService>
  /** What RSD says about the device (UDID, iOS version, model…). */
  readonly properties: XpcDictionary
  /** A checked-in connection to lockdown `service`'s counterpart, or `undefined` when the tunnel has none. */
  openShim(service: string): Promise<Link | undefined>
  /** A checked-in connection to any service RSD lists, by its exact name (`com.apple.mobile.lockdown.remote.trusted`). */
  openService(name: string): Promise<Link | undefined>
  stats(): TcpStats
  close(): Promise<void>
}

/** How a session reaches its services: lockdown `StartService`, or the tunnel. */
export type ServiceRouter = {
  startService(service: string, options?: StartServiceOptions): Promise<Link>
  tunnel(): Promise<DeviceTunnel>
  close(): Promise<void>
}
