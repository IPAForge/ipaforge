export type ConnectionType = 'usb' | 'network'

/** A device as usbmuxd reports it, or as found on the local network (then with its `address`). */
export type UsbmuxDevice = {
  readonly udid: string
  /** usbmuxd's handle for this attachment (changes on every reconnect); negative for one found on Wi-Fi. */
  readonly deviceId: number
  readonly connectionType: ConnectionType
  readonly productId?: number
  /** Its Wi-Fi address when found on the network: reached directly over TCP, without usbmuxd. */
  readonly address?: string
  /**
   * An Apple TV or Apple Vision Pro paired by the code it showed: it has no cable and no classic pairing, so it is
   * only ever reached through its tunnel on Wi-Fi.
   */
  readonly pairedByCode?: true
}

export type DeviceEvent =
  | { readonly kind: 'attached'; readonly device: UsbmuxDevice }
  | {
      readonly kind: 'detached'
      readonly deviceId: number
      readonly udid?: string
    }

/** Identity and state read from lockdownd. */
export type DeviceInfo = {
  readonly udid: string
  readonly name: string
  readonly productType: string
  readonly productVersion: string
  readonly buildVersion: string
  readonly deviceClass: string
  readonly cpuArchitecture?: string
  readonly activationState?: string
  /**
   * lockdownd's `PasswordProtected`: the screen is locked right now. It is not "a passcode is set" (verified on
   * a device with a passcode that reported `false` while unlocked); passcode presence shows up as
   * `device.passcode_required` from Wi-Fi debugging.
   */
  readonly locked?: boolean
}

export type PairingApp = {
  readonly id: string
  readonly name: string
  /** Original bundle ID (before sideloading appends `.<TEAMID>`). */
  readonly bundleId: string
  /** Paths inside the app container. Every name the app (current or legacy builds) reads is written. */
  readonly files: readonly string[]
  /**
   * Where the app reads a remote pairing (iOS 17.4 and later), in its own file: a file with both the classic and
   * the remote keys is ambiguous to it. Absent: the app uses the classic pairing only.
   */
  readonly remoteFiles?: readonly string[]
}

export type PairingAppMatch = {
  readonly app: PairingApp
  /** The bundle ID as installed on the device. */
  readonly bundleId: string
}

export type FindPairingAppsOptions = {
  /** Team IDs of the user's own Apple IDs; sideloaded copies from any other team never match. */
  readonly teamIds: Iterable<string>
  readonly apps?: readonly PairingApp[]
}

/** A provisioning profile installed on the device, as misagent returns it (summary only; the CMS is not verified). */
export type DeviceProfile = {
  readonly uuid: string
  readonly name: string
  readonly teamId?: string
  readonly appIdName?: string
  /** `application-identifier` entitlement, e.g. `ABCDE12345.com.example.app` (may contain `*`). */
  readonly applicationIdentifier?: string
  readonly expirationDate?: Date
  readonly raw: Uint8Array
}

export type RemoveStaleOptions = {
  readonly now: Date
  /** Also remove this team's profiles whose app is no longer installed. */
  readonly teamId?: string
}

/** A device seen before, so it can be recognised on the network: its UDID and its real Wi-Fi MAC address. */
/** A device paired by code (an Apple TV or Apple Vision Pro), as this computer remembers it. */
export type CodePairedDevice = {
  readonly udid: string
  /** The name and model it gave when it was paired (`AppleTV14,1`, `RealityDevice14,1`), when it gave them. */
  readonly name?: string | undefined
  readonly model?: string | undefined
}

/** A device showing its pairing screen on the network: what it calls itself, and where its pairing listens. */
export type PairableDevice = {
  /** Its advert's instance name: the same while its pairing screen stays open. */
  readonly id: string
  readonly name: string
  /** Its model (`AppleTV14,1`), when its advert says. */
  readonly model?: string | undefined
  readonly address: string
  readonly port: number
}

export type PairableEvent =
  | { readonly kind: 'found'; readonly device: PairableDevice }
  | { readonly kind: 'lost'; readonly id: string }

export type KnownWifiDevice = {
  readonly udid: string
  readonly mac?: string | undefined
}
