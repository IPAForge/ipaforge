// Node DeviceTransport: connects to the system usbmuxd (Unix socket on macOS/Linux, TCP 27015 on Windows).
import { connect, type Socket } from "node:net";
import { createNodeConnection } from "@desktop/main/adapters/node-connection.ts";
import type { DeviceTransport } from "@loadstar/device";
import { ErrorCode, LoadstarError } from "@loadstar/kernel";

export type UsbmuxdEndpoint =
  | { readonly kind: "unix"; readonly path: string }
  | { readonly kind: "tcp"; readonly host: string; readonly port: number };

export const DEFAULT_UNIX_SOCKET = "/var/run/usbmuxd";
/** Apple Mobile Device Service on Windows. */
export const DEFAULT_WINDOWS_ENDPOINT: UsbmuxdEndpoint = { kind: "tcp", host: "127.0.0.1", port: 27015 };
const CONNECT_TIMEOUT_MS = 5000;

/**
 * Resolves the usbmuxd endpoint. `USBMUXD_SOCKET_ADDRESS` (the variable libimobiledevice tools use) overrides it:
 * `UNIX:/path/to/socket` or `host:port`.
 */
export const resolveUsbmuxdEndpoint = (
  platform: NodeJS.Platform = process.platform,
  override: string | undefined = process.env.USBMUXD_SOCKET_ADDRESS,
): UsbmuxdEndpoint => {
  if (override) {
    if (override.startsWith("UNIX:")) return { kind: "unix", path: override.slice("UNIX:".length) };
    const colon = override.lastIndexOf(":");
    const port = Number(override.slice(colon + 1));
    if (colon > 0 && Number.isInteger(port) && port > 0 && port <= 0xffff) {
      return { kind: "tcp", host: override.slice(0, colon), port };
    }
    throw new LoadstarError(ErrorCode.UsbmuxdUnavailable, {
      message: `USBMUXD_SOCKET_ADDRESS must be UNIX:/path or host:port, got "${override}"`,
    });
  }
  return platform === "win32" ? DEFAULT_WINDOWS_ENDPOINT : { kind: "unix", path: DEFAULT_UNIX_SOCKET };
};

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

const open = (endpoint: UsbmuxdEndpoint): Promise<Socket> =>
  new Promise((resolve, reject) => {
    const socket =
      endpoint.kind === "unix"
        ? connect({ path: endpoint.path })
        : connect({ host: endpoint.host, port: endpoint.port });
    const timer = setTimeout(() => socket.destroy(new Error("timed out connecting to usbmuxd")), CONNECT_TIMEOUT_MS);
    socket.once("connect", () => {
      clearTimeout(timer);
      socket.off("error", onError);
      resolve(socket);
    });
    const onError = (error: Error) => {
      clearTimeout(timer);
      reject(
        new LoadstarError(ErrorCode.UsbmuxdUnavailable, {
          cause: error,
          data: {
            endpoint: endpoint.kind === "unix" ? endpoint.path : `${endpoint.host}:${endpoint.port}`,
            hint: usbmuxdHint(),
          },
        }),
      );
    };
    socket.once("error", onError);
  });

export const createNodeUsbmuxTransport = (endpoint: UsbmuxdEndpoint = resolveUsbmuxdEndpoint()): DeviceTransport => ({
  connectUsbmux: async () => createNodeConnection(await open(endpoint)),
});
