// Protocol constants fixed by usbmuxd, lockdownd and the device services. Not configuration.

/** usbmux packet header: length, version, message type, tag (all u32 little-endian). */
export const USBMUX_HEADER_SIZE = 16;
export const USBMUX_VERSION_PLIST = 1;
export const USBMUX_MESSAGE_PLIST = 8;
/** `kLibUSBMuxVersion` sent with every usbmuxd request. */
export const USBMUX_LIB_VERSION = 3;

/** usbmuxd `Result` numbers. */
export const UsbmuxResult = {
  Ok: 0,
  BadCommand: 1,
  BadDevice: 2,
  ConnectionRefused: 3,
  BadVersion: 6,
} as const;

/** lockdownd listens on this device port. */
export const LOCKDOWN_PORT = 62078;
export const LOCKDOWN_PROTOCOL_VERSION = "2";
export const LOCKDOWN_QUERY_TYPE = "com.apple.mobile.lockdown";
/** lockdownd key holding the device's Wi-Fi MAC address (pair records and pairing files need it). */
export const LOCKDOWN_WIFI_ADDRESS_KEY = "WiFiAddress";

/** Plist-service frames: a 4-byte big-endian length, then an XML plist. */
export const PLIST_SERVICE_HEADER_SIZE = 4;

export const Service = {
  Afc: "com.apple.afc",
  HouseArrest: "com.apple.mobile.house_arrest",
  InstallationProxy: "com.apple.mobile.installation_proxy",
  Misagent: "com.apple.misagent",
  Amfi: "com.apple.amfi.lockdown",
} as const;

export const LockdownDomain = {
  Amfi: "com.apple.security.mac.amfi",
  WirelessLockdown: "com.apple.mobile.wireless_lockdown",
} as const;

/** Directory every install is staged in (relative to the AFC root). */
export const PUBLIC_STAGING_DIR = "PublicStaging";

/** Developer Mode exists from iOS 16. */
export const DEVELOPER_MODE_MIN_IOS = 16;
