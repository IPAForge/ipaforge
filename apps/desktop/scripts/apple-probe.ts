// Maintainer tool: exercises @loadstar/apple against Apple with real accounts. Run it in your own terminal:
//
//   pnpm --filter @loadstar/desktop apple-probe preflight   # Apple reachable? clock right? anisette servers healthy?
//   pnpm --filter @loadstar/desktop apple-probe anisette    # which server works (header names only, never values)
//   pnpm --filter @loadstar/desktop apple-probe signin      # interactive: one or more Apple IDs, 2FA, app token,
//                                                           # then switching between the saved accounts
//
// Only the anisette (machine) identity is kept on disk, in ~/.loadstar/dev/anisette.json (0600); accounts, sessions
// and passwords live in memory for this run only.
// Passwords are read without echo and never printed or logged; tokens and keys are never printed.
import { homedir } from "node:os";
import { join } from "node:path";
import { createInterface } from "node:readline/promises";
import { createFileSecretStore, createRoutedSecretStore } from "@desktop/main/adapters/file-secret-store.ts";
import { createNodeHttpClient } from "@desktop/main/adapters/http-client.ts";
import { createMemorySecretStore } from "@desktop/main/adapters/memory-secret-store.ts";
import { createWebSocketFactory } from "@desktop/main/adapters/web-socket.ts";
import { createAppleAccounts, type SignInResult, type TwoFactorChallenge, type TwoFactorMethod } from "@loadstar/apple";
import { createLogger, LoadstarError, parseLogLevel } from "@loadstar/kernel";

const command = process.argv[2] ?? "signin";
const logger = createLogger({
  level: parseLogLevel(process.env.LOG_LEVEL, "warn"),
  sink: (record) => console.error(`  [${record.level}] ${record.scope ?? ""} ${record.msg}`, record.fields),
});
const apple = createAppleAccounts({
  http: createNodeHttpClient(),
  webSocket: createWebSocketFactory(),
  // Like a real installation, this computer keeps one anisette (machine) identity across runs; Apple treats a new
  // machine on every attempt as suspicious. Only that identity is written to disk; accounts stay in memory.
  secrets: createRoutedSecretStore(
    ["anisette/"],
    createFileSecretStore(join(homedir(), ".loadstar", "dev", "anisette.json")),
    createMemorySecretStore(),
  ),
  logger,
});

const rl = createInterface({ input: process.stdin, output: process.stdout });
const ask = (question: string) => rl.question(question);

/** Reads a line without echoing it. */
const askHidden = async (question: string): Promise<string> => {
  const output = process.stdout as NodeJS.WriteStream & { _mute?: boolean };
  process.stdout.write(question);
  const original = output.write.bind(output);
  output.write = ((chunk: string | Uint8Array, ...rest: unknown[]) =>
    typeof chunk === "string" && chunk.includes("\n") ? original("\n", ...(rest as [])) : true) as typeof output.write;
  try {
    return await rl.question("");
  } finally {
    output.write = original;
  }
};

const mask = (value: string) => (value.length <= 4 ? "****" : `${value.slice(0, 2)}…${value.slice(-2)}`);

const describe = (error: unknown): string =>
  error instanceof LoadstarError
    ? `${error.code}${error.message !== error.code ? ` (${error.message})` : ""}${error.data ? ` ${JSON.stringify(error.data)}` : ""}`
    : String(error);

const twoFactor = async (challenge: TwoFactorChallenge) => {
  console.log(`  Apple asks for a second factor (${challenge.requested.replace("_", " ")}).`);
  const methods = await challenge.methods();
  const options: { label: string; method: TwoFactorMethod }[] = [];
  if (methods.trustedDevice)
    options.push({ label: "code shown on your trusted device", method: { type: "trusted_device" } });
  for (const phone of methods.phones)
    options.push({ label: `SMS to ${phone.number}`, method: { type: "sms", phoneId: phone.id } });
  for (const [i, option] of options.entries()) console.log(`    ${i + 1}. ${option.label}`);
  const choice = options[Number(await ask(`  Choose [1-${options.length}] (default 1): `)) - 1] ?? options[0];
  if (!choice) throw new Error("no second-factor method available");
  if (choice.method.type !== "trusted_device") await challenge.requestCode(choice.method);
  for (;;) {
    const code = (await ask(`  Enter the ${methods.codeLength}-digit code (or "resend"): `)).trim();
    if (code === "resend") {
      await challenge.requestCode(choice.method);
      console.log("  Sent again.");
      continue;
    }
    try {
      return await challenge.submitCode(choice.method, code);
    } catch (error) {
      if (error instanceof LoadstarError && error.code === "apple.two_factor_invalid_code") {
        console.log("  That code was not accepted; try again.");
        continue;
      }
      throw error;
    }
  }
};

const signInOnce = async () => {
  const appleId = (await ask("\nApple ID (email or phone): ")).trim();
  const password = await askHidden("Password (hidden): ");
  const started = Date.now();
  let result: SignInResult = await apple.signIn({ appleId, password });
  const session = result.kind === "signed_in" ? result.session : await twoFactor(result.challenge);
  result = { kind: "signed_in", session };
  const remember =
    (await ask("  Remember the password for this run (to test re-sign-in)? [y/N] ")).trim().toLowerCase() === "y";
  const account = await apple.accounts.save(session, remember ? { rememberPassword: password } : {});
  const token = await apple.appToken(session);
  console.log(
    `  ✓ signed in as ${account.displayName ?? "(no name)"} [adsid ${mask(session.adsid)}] in ${Date.now() - started} ms`,
  );
  console.log(`  ✓ developer-services token received, valid until ${token.expiresAt.toISOString()}`);
};

const commands: Record<string, () => Promise<void>> = {
  preflight: async () => {
    const report = await apple.preflight();
    console.log(`Apple reachable: ${report.apple.ok}${report.apple.error ? ` (${report.apple.error})` : ""}`);
    console.log(
      `Clock: ${report.clockOk ? "ok" : "WRONG"}${report.clockSkewSeconds === undefined ? "" : ` (skew ${report.clockSkewSeconds}s)`}`,
    );
    for (const server of report.anisette) {
      console.log(
        `Anisette ${server.server.name} (${server.server.address}): ${server.ok ? `ok, ${server.latencyMs} ms` : `down: ${server.error}`}`,
      );
    }
    console.log(report.problem ? `Problem: ${report.problem}` : "No problems found.");
  },
  anisette: async () => {
    const data = await apple.anisette.get();
    console.log(`Anisette from "${data.server}"; headers: ${Object.keys(data.headers).sort().join(", ")}`);
    console.log(`Client identity: ${data.identity.clientInfo}`);
  },
  signin: async () => {
    console.log("Sign in with one or more Apple IDs. Accounts are not saved to disk.");
    for (;;) {
      try {
        await signInOnce();
      } catch (error) {
        console.log(`  ✗ ${describe(error)}`);
      }
      if ((await ask("\nAdd another Apple ID? [y/N] ")).trim().toLowerCase() !== "y") break;
    }
    const accounts = await apple.accounts.list();
    if (accounts.length === 0) return;
    console.log("\nSaved accounts (this run):");
    for (const account of accounts) console.log(`  - ${account.appleId} (${account.displayName ?? "?"})`);
    console.log("\nSwitching between them (re-using each saved session):");
    for (const account of accounts) {
      try {
        await apple.accounts.switchTo(account.id);
        const resumed = await apple.resume(account.id);
        console.log(`  ${account.appleId}: ${resumed.kind === "signed_in" ? "✓ session still valid" : resumed.kind}`);
      } catch (error) {
        console.log(`  ${account.appleId}: ✗ ${describe(error)}`);
      }
    }
  },
};

const run = commands[command];
if (!run) {
  console.error(`unknown command "${command}"; one of: ${Object.keys(commands).join(", ")}`);
  process.exit(2);
}
try {
  await run();
} catch (error) {
  console.error(`✗ ${describe(error)}`);
  process.exitCode = 1;
} finally {
  rl.close();
}
