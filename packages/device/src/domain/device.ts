export type ConnectionType = "usb" | "network";

/** A device as usbmuxd reports it. */
export interface UsbmuxDevice {
  readonly udid: string;
  /** usbmuxd's handle for this attachment (changes on every reconnect). */
  readonly deviceId: number;
  readonly connectionType: ConnectionType;
  readonly productId?: number;
}

export type DeviceEvent =
  | { readonly kind: "attached"; readonly device: UsbmuxDevice }
  | { readonly kind: "detached"; readonly deviceId: number; readonly udid?: string };

/** Identity and state read from lockdownd. */
export interface DeviceInfo {
  readonly udid: string;
  readonly name: string;
  readonly productType: string;
  readonly productVersion: string;
  readonly buildVersion: string;
  readonly deviceClass: string;
  readonly cpuArchitecture?: string;
  readonly activationState?: string;
  /**
   * lockdownd's `PasswordProtected`: the screen is locked right now. It is not "a passcode is set" (verified on
   * a device with a passcode that reported `false` while unlocked); passcode presence shows up as
   * `device.passcode_required` from Wi-Fi debugging.
   */
  readonly locked?: boolean;
}

/** Shortens a UDID for logs and UI (`…1a2b`). */
export const shortUdid = (udid: string): string => `…${udid.slice(-4)}`;

/** Parses "17.4.1" → [17, 4, 1]; missing parts are 0. */
export const parseVersion = (version: string): readonly [number, number, number] => {
  const [major = 0, minor = 0, patch = 0] = version.split(".").map((part) => Number.parseInt(part, 10) || 0);
  return [major, minor, patch];
};
