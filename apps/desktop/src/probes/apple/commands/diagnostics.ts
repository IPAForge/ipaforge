// `apple-probe preflight` and `apple-probe anisette`: connectivity checks that need no account.
import type { AppleProbe } from "@desktop/probes/apple/context.ts";

export const preflightCommand = (probe: AppleProbe) => async (): Promise<void> => {
  const report = await probe.apple.preflight();
  console.log(`Apple reachable: ${report.apple.ok}${report.apple.error ? ` (${report.apple.error})` : ""}`);
  const skew = report.clockSkewSeconds === undefined ? "" : ` (skew ${report.clockSkewSeconds}s)`;
  console.log(`Clock: ${report.clockOk ? "ok" : "WRONG"}${skew}`);
  for (const server of report.anisette) {
    const health = server.ok ? `ok, ${server.latencyMs} ms` : `down: ${server.error}`;
    console.log(`Anisette ${server.server.name} (${server.server.address}): ${health}`);
  }
  console.log(report.problem ? `Problem: ${report.problem}` : "No problems found.");
};

/** Prints which server answered and the header names only, never their values. */
export const anisetteCommand = (probe: AppleProbe) => async (): Promise<void> => {
  const data = await probe.apple.anisette.get();
  console.log(`Anisette from "${data.server}"; headers: ${Object.keys(data.headers).sort().join(", ")}`);
  console.log(`Client identity: ${data.identity.clientInfo}`);
};
