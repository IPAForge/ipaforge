// Anisette with automatic failover: users never have to pick a server. Servers come from the remote list (plus a
// built-in fallback and any custom server); the last server that worked is tried first; each server keeps its own
// provisioning state; a server that says "not provisioned" is re-provisioned once.

import type { AppleDeps } from "@apple/deps.ts";
import { ANISETTE_IDENTIFIER_BYTES, type AnisetteData, type AnisetteState } from "@apple/domain/anisette.ts";
import type { AnisetteServer, ClientIdentity } from "@apple/domain/config.ts";
import { fetchV1, identityFromV1 } from "@apple/infrastructure/anisette/v1.ts";
import { completeHeaders, fetchClientInfo, getHeadersV3, provisionV3 } from "@apple/infrastructure/anisette/v3.ts";
import { fetchApple } from "@apple/infrastructure/http.ts";
import { ErrorCode, fromBase64, LoadstarError, toBase64, utf8Decode, utf8Encode } from "@loadstar/kernel";
import { z } from "zod";

const LAST_GOOD_KEY = "anisette/last-good";
const stateKey = (server: AnisetteServer): string => `anisette/state/${new URL(server.address).host}`;

const serverListSchema = z.looseObject({
  servers: z.array(z.looseObject({ name: z.string().min(1), address: z.string().url() })),
});

const stateSchema = z.object({ identifier: z.string(), adiPb: z.string().optional() });

export interface ServerHealth {
  readonly server: AnisetteServer;
  readonly ok: boolean;
  readonly latencyMs?: number;
  readonly error?: string;
}

export interface AnisetteService {
  /** Remote list (cached for the session) + built-in fallback, deduplicated, in preference order. */
  servers(): Promise<AnisetteServer[]>;
  health(server: AnisetteServer): Promise<ServerHealth>;
  /** Headers and client identity from the first server that works. */
  get(options?: { readonly preferred?: AnisetteServer; readonly signal?: AbortSignal }): Promise<AnisetteData>;
  /**
   * Resyncs this machine with the same server after GSA answered hsc 434, returning corrected headers.
   * `resyncData` is the base64 `X-Apple-I-MD-DATA` from that answer.
   */
  resync(data: AnisetteData, resyncData: string): Promise<AnisetteData>;
  /** Forgets provisioning state (all servers when omitted). Missing state is not an error. */
  reset(server?: AnisetteServer): Promise<void>;
}

const dedupe = (servers: readonly AnisetteServer[]): AnisetteServer[] => {
  const seen = new Set<string>();
  return servers.filter((server) => {
    const key = server.address.replace(/\/+$/, "").toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

export const createAnisetteService = (deps: AppleDeps, options: { custom?: AnisetteServer } = {}): AnisetteService => {
  const { logger, secrets, config } = deps;
  let cachedList: AnisetteServer[] | undefined;

  const loadState = async (server: AnisetteServer): Promise<AnisetteState | undefined> => {
    const raw = await secrets.get(stateKey(server));
    if (!raw) return undefined;
    const parsed = stateSchema.safeParse(JSON.parse(utf8Decode(raw)));
    if (!parsed.success) return undefined;
    return {
      identifier: fromBase64(parsed.data.identifier),
      ...(parsed.data.adiPb ? { adiPb: fromBase64(parsed.data.adiPb) } : {}),
    };
  };

  const saveState = (server: AnisetteServer, state: AnisetteState) =>
    secrets.set(
      stateKey(server),
      utf8Encode(
        JSON.stringify({
          identifier: toBase64(state.identifier),
          ...(state.adiPb ? { adiPb: toBase64(state.adiPb) } : {}),
        }),
      ),
    );

  const identityFor = async (server: AnisetteServer): Promise<ClientIdentity> => {
    try {
      return await fetchClientInfo(deps, server);
    } catch (error) {
      logger.debug("anisette server has no client_info; using the default identity", {
        server: server.name,
        cause: error,
      });
      return config.defaultIdentity;
    }
  };

  const fromV3 = async (server: AnisetteServer, signal?: AbortSignal): Promise<AnisetteData> => {
    const identity = await identityFor(server);
    let state = (await loadState(server)) ?? { identifier: deps.randomBytes(ANISETTE_IDENTIFIER_BYTES) };
    for (let attempt = 0; attempt < 2; attempt++) {
      signal?.throwIfAborted();
      if (!state.adiPb) {
        state = { ...state, adiPb: await provisionV3(deps, server, state.identifier, identity) };
        await saveState(server, state);
      }
      const result = await getHeadersV3(deps, server, state.identifier, state.adiPb as Uint8Array);
      if (result.kind === "headers") {
        return {
          headers: await completeHeaders(deps, state.identifier, result.headers),
          identity,
          server: server.name,
          serverAddress: server.address,
        };
      }
      logger.warn("anisette state rejected; provisioning again", { server: server.name, message: result.message });
      state = { identifier: state.identifier };
    }
    throw new LoadstarError(ErrorCode.AnisetteNotProvisioned, { data: { server: server.name } });
  };

  const fromV1 = async (server: AnisetteServer): Promise<AnisetteData> => {
    const result = await fetchV1(deps, server);
    return {
      headers: result.headers,
      identity: identityFromV1(result, config.defaultIdentity),
      server: server.name,
      serverAddress: server.address,
    };
  };

  const service: AnisetteService = {
    servers: async () => {
      if (!cachedList) {
        try {
          const response = await fetchApple(deps, config.anisetteServerListUrl, {
            timeoutMs: config.timeouts.healthCheckMs,
          });
          const remote = serverListSchema.parse(JSON.parse(utf8Decode(response.body))).servers;
          // The remote list is untrusted input: an anisette server sees this machine's identity and relays its
          // provisioning, so only HTTPS servers are accepted from it. Plain HTTP is allowed only for a server the
          // user configured explicitly (e.g. a local sidecar).
          cachedList = remote.filter((server) => {
            const secure = server.address.startsWith("https://");
            if (!secure)
              logger.warn("ignoring non-HTTPS anisette server from the remote list", { server: server.name });
            return secure;
          });
        } catch (error) {
          logger.warn("anisette server list unavailable; using the built-in list", { cause: error });
          cachedList = [];
        }
      }
      return dedupe([...(options.custom ? [options.custom] : []), ...config.fallbackAnisetteServers, ...cachedList]);
    },

    health: async (server) => {
      const started = deps.clock.now().getTime();
      try {
        if (server.protocol === "v1") await fetchV1(deps, server, config.timeouts.healthCheckMs);
        else await fetchClientInfo(deps, server, config.timeouts.healthCheckMs);
        return { server, ok: true, latencyMs: deps.clock.now().getTime() - started };
      } catch (error) {
        return { server, ok: false, error: error instanceof Error ? error.message : String(error) };
      }
    },

    get: async (getOptions = {}) => {
      const all = await service.servers();
      const lastGood = await secrets.get(LAST_GOOD_KEY).then((raw) => (raw ? utf8Decode(raw) : undefined));
      const ordered = dedupe([
        ...(getOptions.preferred ? [getOptions.preferred] : []),
        ...all.filter((server) => server.address === lastGood),
        ...all,
      ]);
      const failures: { server: string; error: string }[] = [];
      for (const server of ordered) {
        getOptions.signal?.throwIfAborted();
        try {
          const data = server.protocol === "v1" ? await fromV1(server) : await fromV3(server, getOptions.signal);
          if (lastGood !== server.address) await secrets.set(LAST_GOOD_KEY, utf8Encode(server.address));
          logger.debug("anisette ready", { server: server.name });
          return data;
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          failures.push({ server: server.name, error: message });
          logger.warn("anisette server failed; trying the next one", { server: server.name, error: message });
        }
      }
      throw new LoadstarError(ErrorCode.AnisetteUnavailable, {
        message: `no anisette server worked (${failures.length} tried)`,
        data: { tried: failures },
      });
    },

    resync: async (data, resyncData) => {
      const server = (await service.servers()).find((candidate) => candidate.address === data.serverAddress) ?? {
        name: data.server,
        address: data.serverAddress,
      };
      if (server.protocol === "v1") {
        throw new LoadstarError(ErrorCode.AnisetteUnavailable, { message: "this anisette server cannot resync" });
      }
      const state = await loadState(server);
      if (!state?.adiPb) throw new LoadstarError(ErrorCode.AnisetteNotProvisioned, { data: { server: server.name } });
      const result = await getHeadersV3(deps, server, state.identifier, state.adiPb, resyncData);
      if (result.kind !== "headers") {
        throw new LoadstarError(ErrorCode.AnisetteNotProvisioned, {
          message: result.message,
          data: { server: server.name },
        });
      }
      logger.info("anisette resynced", { server: server.name });
      return { ...data, headers: await completeHeaders(deps, state.identifier, result.headers) };
    },

    reset: async (server) => {
      const targets = server ? [server] : await service.servers();
      for (const target of targets) await secrets.delete(stateKey(target));
      if (!server) await secrets.delete(LAST_GOOD_KEY);
    },
  };
  return service;
};
