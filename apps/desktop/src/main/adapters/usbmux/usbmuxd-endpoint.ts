// Where the system usbmuxd listens: a Unix socket on macOS/Linux, TCP 27015 on Windows.
import { ErrorCode, LoadstarError } from "@loadstar/kernel";

export type UsbmuxdEndpoint =
  | { readonly kind: "unix"; readonly path: string }
  | { readonly kind: "tcp"; readonly host: string; readonly port: number };

export const DEFAULT_UNIX_SOCKET = "/var/run/usbmuxd";
/** Apple Mobile Device Service on Windows. */
export const DEFAULT_WINDOWS_ENDPOINT: UsbmuxdEndpoint = { kind: "tcp", host: "127.0.0.1", port: 27015 };

const UNIX_PREFIX = "UNIX:";

const isPort = (port: number): boolean => Number.isInteger(port) && port > 0 && port <= 0xffff;

/** Parses `UNIX:/path/to/socket` or `host:port`. */
const parseEndpoint = (address: string): UsbmuxdEndpoint => {
  if (address.startsWith(UNIX_PREFIX)) return { kind: "unix", path: address.slice(UNIX_PREFIX.length) };
  const colon = address.lastIndexOf(":");
  const port = Number(address.slice(colon + 1));
  if (colon > 0 && isPort(port)) return { kind: "tcp", host: address.slice(0, colon), port };
  throw new LoadstarError(ErrorCode.UsbmuxdUnavailable, {
    message: `USBMUXD_SOCKET_ADDRESS must be UNIX:/path or host:port, got "${address}"`,
  });
};

/**
 * Resolves the usbmuxd endpoint. `USBMUXD_SOCKET_ADDRESS` (the variable libimobiledevice tools use) overrides it:
 * `UNIX:/path/to/socket` or `host:port`.
 */
export const resolveUsbmuxdEndpoint = (
  platform: NodeJS.Platform = process.platform,
  override: string | undefined = process.env.USBMUXD_SOCKET_ADDRESS,
): UsbmuxdEndpoint => {
  if (override) return parseEndpoint(override);
  return platform === "win32" ? DEFAULT_WINDOWS_ENDPOINT : { kind: "unix", path: DEFAULT_UNIX_SOCKET };
};

/** The endpoint as shown in errors: the socket path or `host:port`. */
export const describeEndpoint = (endpoint: UsbmuxdEndpoint): string =>
  endpoint.kind === "unix" ? endpoint.path : `${endpoint.host}:${endpoint.port}`;

/** What to tell the user when usbmuxd is missing, per OS. */
export const usbmuxdHint = (platform: NodeJS.Platform = process.platform): string => {
  if (platform === "win32") {
    return "Install Apple Devices from the Microsoft Store (or iTunes from Apple) and make sure the Apple Mobile Device Service is running.";
  }
  if (platform === "linux") {
    return "Install usbmuxd from your package manager, plug in the device (usbmuxd starts on demand), or run `sudo systemctl restart usbmuxd`.";
  }
  return "usbmuxd is part of macOS; reconnect the device and try again.";
};
