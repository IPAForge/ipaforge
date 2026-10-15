// What every apple-probe command works with: the Apple accounts service wired to Node adapters, and the prompt.
import { homedir } from "node:os";
import { join } from "node:path";
import { createEncryptedFileSecretStore } from "@desktop/main/adapters/encrypted-file-secret-store.ts";
import { createFileSecretStore } from "@desktop/main/adapters/file-secret-store.ts";
import { createNodeHttpClient } from "@desktop/main/adapters/http-client.ts";
import { createMemorySecretStore } from "@desktop/main/adapters/memory-secret-store.ts";
import { createRoutedSecretStore } from "@desktop/main/adapters/routed-secret-store.ts";
import { macKeychainKey } from "@desktop/main/adapters/secrets/mac-keychain-key.ts";
import { createWebSocketFactory } from "@desktop/main/adapters/web-socket.ts";
import { createProbeLogger } from "@desktop/probes/shared/logger.ts";
import { createPrompt, type Prompt } from "@desktop/probes/shared/prompt.ts";
import { type AppleAccounts, createAppleAccounts } from "@loadstar/apple";
import type { SecretStore } from "@loadstar/kernel";

const DEV_DIR = join(homedir(), ".loadstar", "dev");
const KEYCHAIN_SERVICE = "dev.loadstar.probe";

export interface AppleProbe {
  readonly apple: AppleAccounts;
  readonly prompt: Prompt;
  /** Accounts survive between runs only where an encrypted store is available (macOS). */
  readonly persistAccounts: boolean;
  readonly secretsFile: string;
}

const accountStore = (persist: boolean, secretsFile: string): SecretStore =>
  persist ? createEncryptedFileSecretStore(secretsFile, macKeychainKey(KEYCHAIN_SERVICE)) : createMemorySecretStore();

export const createAppleProbe = (): AppleProbe => {
  const persistAccounts = process.platform === "darwin";
  const secretsFile = join(DEV_DIR, "secrets.enc");
  const apple = createAppleAccounts({
    http: createNodeHttpClient(),
    webSocket: createWebSocketFactory(),
    // Like a real installation, this computer keeps one anisette (machine) identity across runs; Apple treats a
    // new machine on every attempt as suspicious.
    secrets: createRoutedSecretStore(
      ["anisette/"],
      createFileSecretStore(join(DEV_DIR, "anisette.json")),
      accountStore(persistAccounts, secretsFile),
    ),
    logger: createProbeLogger("  "),
  });
  return { apple, prompt: createPrompt(), persistAccounts, secretsFile };
};
