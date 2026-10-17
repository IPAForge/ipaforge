export type ConnectionType = 'usb' | 'network'

/** A device as usbmuxd reports it. */
export type UsbmuxDevice = {
  readonly udid: string
  /** usbmuxd's handle for this attachment (changes on every reconnect). */
  readonly deviceId: number
  readonly connectionType: ConnectionType
  readonly productId?: number
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
