// Maintainer tool: exercises @loadstar/apple against Apple with real accounts. Run it in your own terminal:
//
//   pnpm --filter @loadstar/desktop apple-probe preflight   # Apple reachable? clock right? anisette servers healthy?
//   pnpm --filter @loadstar/desktop apple-probe anisette    # which server works (header names only, never values)
//   pnpm --filter @loadstar/desktop apple-probe developer   # interactive sign-in, then READ-ONLY: teams, devices,
//                                                           # certificates (who made them), App IDs and quota
//   pnpm --filter @loadstar/desktop apple-probe signin      # sign in one or more Apple IDs (2FA, app token), saved
//   pnpm --filter @loadstar/desktop apple-probe accounts    # check every saved account's session
//   pnpm --filter @loadstar/desktop apple-probe forget      # delete saved accounts, sessions and passwords
//
// Saved between runs (so you do not sign in every time):
// - the anisette (machine) identity: ~/.loadstar/dev/anisette.json (0600);
// - accounts and sessions, and a password only if you agree: ~/.loadstar/dev/secrets.enc, AES-256-GCM encrypted
//   with a key in your macOS login keychain ("dev.loadstar.probe"). Elsewhere: kept in memory only.
// `apple-probe forget` deletes the saved accounts.
// Passwords are read without echo and never printed or logged; tokens and keys are never printed.
import { rm } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { createInterface } from "node:readline/promises";
import { createEncryptedFileSecretStore, macKeychainKey } from "@desktop/main/adapters/encrypted-file-secret-store.ts";
import { createFileSecretStore, createRoutedSecretStore } from "@desktop/main/adapters/file-secret-store.ts";
import { createNodeHttpClient } from "@desktop/main/adapters/http-client.ts";
import { createMemorySecretStore } from "@desktop/main/adapters/memory-secret-store.ts";
import { createWebSocketFactory } from "@desktop/main/adapters/web-socket.ts";
import {
  type AppleSession,
  createAppleAccounts,
  type SignInResult,
  type TwoFactorChallenge,
  type TwoFactorMethod,
} from "@loadstar/apple";
import { createLogger, LoadstarError, parseLogLevel } from "@loadstar/kernel";

const command = process.argv[2] ?? "signin";
const DEV_DIR = join(homedir(), ".loadstar", "dev");
const SECRETS_FILE = join(DEV_DIR, "secrets.enc");
const persistAccounts = process.platform === "darwin";
const accountStore = persistAccounts
  ? createEncryptedFileSecretStore(SECRETS_FILE, macKeychainKey("dev.loadstar.probe"))
  : createMemorySecretStore();
const logger = createLogger({
  level: parseLogLevel(process.env.LOG_LEVEL, "warn"),
  sink: (record) => console.error(`  [${record.level}] ${record.scope ?? ""} ${record.msg}`, record.fields),
});
const apple = createAppleAccounts({
  http: createNodeHttpClient(),
  webSocket: createWebSocketFactory(),
  // Like a real installation, this computer keeps one anisette (machine) identity across runs; Apple treats a new
  // machine on every attempt as suspicious.
  secrets: createRoutedSecretStore(["anisette/"], createFileSecretStore(join(DEV_DIR, "anisette.json")), accountStore),
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

/** A new interactive sign-in; the session is saved, the password only if the user agrees. */
const newSignIn = async (presetAppleId?: string): Promise<AppleSession> => {
  const appleId = presetAppleId ?? (await ask("\nApple ID (email or phone): ")).trim();
  const password = await askHidden(`Password for ${appleId} (hidden): `);
  const started = Date.now();
  const result: SignInResult = await apple.signIn({ appleId, password });
  const session = result.kind === "signed_in" ? result.session : await twoFactor(result.challenge);
  const remember =
    persistAccounts &&
    (await ask("  Save the password in your Keychain-protected store too? [y/N] ")).trim().toLowerCase() === "y";
  const account = await apple.accounts.save(session, remember ? { rememberPassword: password } : {});
  console.log(
    `  ✓ signed in as ${account.displayName ?? "(no name)"} [adsid ${mask(session.adsid)}] in ${Date.now() - started} ms` +
      (persistAccounts ? " — session saved" : ""),
  );
  return session;
};

/** Offers saved accounts first (re-using their sessions), otherwise signs in. */
const obtainSession = async (): Promise<AppleSession> => {
  const saved = await apple.accounts.list();
  if (saved.length > 0) {
    console.log("\nSaved accounts:");
    for (const [i, account] of saved.entries())
      console.log(`  ${i + 1}. ${account.appleId} (${account.displayName ?? "?"})`);
    console.log(`  ${saved.length + 1}. another Apple ID`);
    const picked = saved[Number((await ask(`Choose [1-${saved.length + 1}] (default 1): `)) || "1") - 1];
    if (picked) {
      const resumed = await apple.resume(picked.id);
      if (resumed.kind === "signed_in") {
        console.log(`  ✓ using the saved session for ${picked.appleId}`);
        return resumed.session;
      }
      if (resumed.kind === "two_factor") return twoFactor(resumed.challenge);
      console.log("  The saved session expired; please sign in again.");
      return newSignIn(picked.appleId);
    }
  }
  return newSignIn();
};

const commands: Record<string, () => Promise<void>> = {
  developer: async () => {
    console.log("Read-only: lists teams, devices, certificates and App IDs. Nothing is created or changed.");
    const developer = apple.developer(await obtainSession());
    for (const team of await developer.teams()) {
      console.log(
        `\nTeam ${team.name} [${team.id}] ${team.isFree ? "(free)" : ""} ${team.type ?? ""} ${team.status ?? ""}`,
      );
      const devices = await developer.devices(team);
      console.log(`  devices: ${devices.length}${devices.map((d) => `\n    - ${d.name ?? "?"}`).join("")}`);
      const certificates = await developer.certificates(team);
      console.log(`  iOS development certificates: ${certificates.length}`);
      for (const certificate of certificates) {
        console.log(
          `    - made by "${certificate.machineName ?? certificate.name ?? "?"}", expires ${certificate.expiresAt?.toISOString().slice(0, 10) ?? "?"}`,
        );
      }
      const { appIds, quota } = await developer.appIds(team);
      console.log(
        `  App IDs: ${appIds.length}, available now: ${quota.available}${quota.max ? ` of ${quota.max}` : ""}`,
      );
      for (const appId of appIds) {
        console.log(
          `    - ${appId.identifier}${appId.expiresAt ? ` (frees ${appId.expiresAt.toISOString().slice(0, 10)})` : ""}`,
        );
      }
    }
  },
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
    for (;;) {
      try {
        const session = await newSignIn();
        const token = await apple.appToken(session);
        console.log(`  ✓ developer-services token received, valid until ${token.expiresAt.toISOString()}`);
      } catch (error) {
        console.log(`  ✗ ${describe(error)}`);
      }
      if ((await ask("\nAdd another Apple ID? [y/N] ")).trim().toLowerCase() !== "y") break;
    }
    await commands.accounts?.();
  },
  accounts: async () => {
    const accounts = await apple.accounts.list();
    if (accounts.length === 0) {
      console.log("No saved accounts.");
      return;
    }
    console.log("\nSaved accounts — checking each saved session:");
    for (const account of accounts) {
      try {
        await apple.accounts.switchTo(account.id);
        const resumed = await apple.resume(account.id);
        console.log(`  ${account.appleId}: ${resumed.kind === "signed_in" ? "✓ session valid" : resumed.kind}`);
      } catch (error) {
        console.log(`  ${account.appleId}: ✗ ${describe(error)}`);
      }
    }
  },
  forget: async () => {
    for (const account of await apple.accounts.list()) await apple.accounts.remove(account.id);
    await rm(SECRETS_FILE, { force: true });
    console.log("Saved accounts, sessions and passwords deleted (the machine identity is kept).");
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
