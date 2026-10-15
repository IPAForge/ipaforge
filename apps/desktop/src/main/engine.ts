// Composition root for the Engine: the Node adapters wired into every context, then into the installer.
import { join } from "node:path";
import { createFileDownloadStore } from "@desktop/main/adapters/file-download-store.ts";
import { createFileScratchStore } from "@desktop/main/adapters/file-scratch-store.ts";
import { createNodeHttpClient } from "@desktop/main/adapters/http-client.ts";
import { createNodeUsbmuxTransport } from "@desktop/main/adapters/usbmux-transport.ts";
import { createWebSocketFactory } from "@desktop/main/adapters/web-socket.ts";
import { createAppleAccounts } from "@loadstar/apple";
import { createCatalog } from "@loadstar/catalog";
import { createDeviceManager } from "@loadstar/device";
import { createEngine, type Engine } from "@loadstar/installer";
import { type Logger, type SecretStore, silentLogger } from "@loadstar/kernel";

export interface DesktopEngineOptions {
  /** Accounts, sessions, certificates and their keys, pair records the OS would not keep. */
  readonly secrets: SecretStore;
  /** Downloads go to `<dataDir>/downloads`, signed IPAs wait in `<dataDir>/scratch`. */
  readonly dataDir: string;
  readonly logger?: Logger;
}

export const createDesktopEngine = ({ secrets, dataDir, logger = silentLogger }: DesktopEngineOptions): Engine => {
  const http = createNodeHttpClient();
  return createEngine({
    devices: createDeviceManager({ transport: createNodeUsbmuxTransport(), secrets, logger }),
    apple: createAppleAccounts({ http, webSocket: createWebSocketFactory(), secrets, logger }),
    catalog: createCatalog({ http, store: createFileDownloadStore(join(dataDir, "downloads")), logger }),
    secrets,
    scratch: createFileScratchStore(join(dataDir, "scratch")),
    logger,
  });
};
