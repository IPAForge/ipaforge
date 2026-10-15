// What every apple-probe command works with: the Apple accounts service wired to Node adapters, and the prompt.
import { createNodeHttpClient } from "@desktop/main/adapters/http-client.ts";
import { createWebSocketFactory } from "@desktop/main/adapters/web-socket.ts";
import { createProbeLogger } from "@desktop/probes/shared/logger.ts";
import { createPrompt, type Prompt } from "@desktop/probes/shared/prompt.ts";
import { createProbeSecrets } from "@desktop/probes/shared/secrets.ts";
import { type AppleAccounts, createAppleAccounts } from "@loadstar/apple";

export interface AppleProbe {
  readonly apple: AppleAccounts;
  readonly prompt: Prompt;
  /** Accounts survive between runs only where an encrypted store is available (macOS). */
  readonly persistAccounts: boolean;
  readonly secretsFile: string;
}

export const createAppleProbe = (): AppleProbe => {
  const { secrets, persistent, secretsFile } = createProbeSecrets();
  const apple = createAppleAccounts({
    http: createNodeHttpClient(),
    webSocket: createWebSocketFactory(),
    secrets,
    logger: createProbeLogger("  "),
  });
  return { apple, prompt: createPrompt(), persistAccounts: persistent, secretsFile };
};
