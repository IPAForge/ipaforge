// Before signing in: can we reach Apple and an anisette server, and is the computer's clock right? Each problem
// gets its own error code instead of a generic "login failed".

import type { AnisetteService, ServerHealth } from "@apple/application/anisette.ts";
import type { AppleDeps } from "@apple/deps.ts";
import { fetchApple } from "@apple/infrastructure/http.ts";
import { ErrorCode, LoadstarError } from "@loadstar/kernel";

export interface PreflightReport {
  readonly apple: { readonly ok: boolean; readonly error?: string };
  /** Server clock minus local clock, when Apple answered with a `Date` header. */
  readonly clockSkewSeconds?: number;
  readonly clockOk: boolean;
  readonly anisette: readonly ServerHealth[];
  /** The first blocking problem, as a catalogued error code. */
  readonly problem?: ErrorCode;
}

/** How many anisette servers to probe (they are probed in parallel). */
const ANISETTE_PROBES = 3;

export const runPreflight = async (deps: AppleDeps, anisette: AnisetteService): Promise<PreflightReport> => {
  const servers = (await anisette.servers()).slice(0, ANISETTE_PROBES);
  const [apple, health] = await Promise.all([
    fetchApple(deps, deps.config.endpoints.gsaLookup, {
      timeoutMs: deps.config.timeouts.healthCheckMs,
      retryTransient: false,
      acceptStatus: () => true,
    }).then(
      (result) => ({ ok: result.status < 500, skew: result.clockSkewMs }),
      (error: unknown) => ({ ok: false, error: error instanceof Error ? error.message : String(error) }),
    ),
    Promise.all(servers.map((server) => anisette.health(server))),
  ]);
  const skewMs = "skew" in apple ? apple.skew : undefined;
  const clockOk = skewMs === undefined || Math.abs(skewMs) <= deps.config.maxClockSkewMs;
  const anisetteOk = health.some((server) => server.ok);
  const problem = !apple.ok
    ? ErrorCode.Offline
    : !clockOk
      ? ErrorCode.ClockSkew
      : !anisetteOk
        ? ErrorCode.AnisetteUnavailable
        : undefined;
  return {
    apple: { ok: apple.ok, ...("error" in apple && apple.error ? { error: apple.error } : {}) },
    ...(skewMs === undefined ? {} : { clockSkewSeconds: Math.round(skewMs / 1000) }),
    clockOk,
    anisette: health,
    ...(problem ? { problem } : {}),
  };
};

/** Throws the report's problem, if any. */
export const assertPreflight = (report: PreflightReport): void => {
  if (report.problem) {
    throw new LoadstarError(report.problem, {
      data: {
        ...(report.clockSkewSeconds === undefined ? {} : { skewSeconds: report.clockSkewSeconds }),
        anisette: report.anisette.map((server) => ({ name: server.server.name, ok: server.ok })),
      },
    });
  }
};
