// Where the probes keep what must survive between runs: the anisette (machine) identity in a plain 0600 file, and
// accounts, sessions, passwords and certificate keys AES-256-GCM encrypted with a key in the macOS login keychain.
// Elsewhere the encrypted part is kept in memory only.
import { homedir } from "node:os";
import { join } from "node:path";
import { createEncryptedFileSecretStore } from "@desktop/main/adapters/encrypted-file-secret-store.ts";
import { createFileSecretStore } from "@desktop/main/adapters/file-secret-store.ts";
import { createMemorySecretStore } from "@desktop/main/adapters/memory-secret-store.ts";
import { createRoutedSecretStore } from "@desktop/main/adapters/routed-secret-store.ts";
import { macKeychainKey } from "@desktop/main/adapters/secrets/mac-keychain-key.ts";
import type { SecretStore } from "@loadstar/kernel";

export const PROBE_DATA_DIR = join(homedir(), ".loadstar", "dev");
const KEYCHAIN_SERVICE = "dev.loadstar.probe";

export interface ProbeSecrets {
  readonly secrets: SecretStore;
  /** Accounts survive between runs only where an encrypted store is available (macOS). */
  readonly persistent: boolean;
  readonly secretsFile: string;
}

export const createProbeSecrets = (): ProbeSecrets => {
  const persistent = process.platform === "darwin";
  const secretsFile = join(PROBE_DATA_DIR, "secrets.enc");
  const sensitive = persistent
    ? createEncryptedFileSecretStore(secretsFile, macKeychainKey(KEYCHAIN_SERVICE))
    : createMemorySecretStore();
  // Like a real installation, this computer keeps one anisette (machine) identity across runs; Apple treats a new
  // machine on every attempt as suspicious.
  const secrets = createRoutedSecretStore(
    ["anisette/"],
    createFileSecretStore(join(PROBE_DATA_DIR, "anisette.json")),
    sensitive,
  );
  return { secrets, persistent, secretsFile };
};
