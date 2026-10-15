// Which anisette servers to try, in which order: a custom server first, then the built-in fallback, then the
// remote community list.

import type { AppleDeps } from "@apple/deps.ts";
import type { AnisetteServer } from "@apple/domain/config.ts";
import { fetchApple } from "@apple/infrastructure/http.ts";
import { utf8Decode } from "@loadstar/kernel";
import { z } from "zod";

const serverListSchema = z.looseObject({
  servers: z.array(z.looseObject({ name: z.string().min(1), address: z.string().url() })),
});

const serverKey = (server: AnisetteServer): string => server.address.replace(/\/+$/, "").toLowerCase();

/** Keeps the first of servers with the same address (ignoring case and trailing slashes). */
export const dedupe = (servers: readonly AnisetteServer[]): AnisetteServer[] => {
  const seen = new Set<string>();
  return servers.filter((server) => {
    const key = serverKey(server);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

/**
 * The remote list is untrusted input: an anisette server sees this machine's identity and relays its
 * provisioning, so only HTTPS servers are accepted from it. Plain HTTP is allowed only for a server the
 * user configured explicitly (e.g. a local sidecar).
 */
const httpsOnly = (deps: AppleDeps, servers: readonly AnisetteServer[]): AnisetteServer[] =>
  servers.filter((server) => {
    const secure = server.address.startsWith("https://");
    if (!secure) deps.logger.warn("ignoring non-HTTPS anisette server from the remote list", { server: server.name });
    return secure;
  });

/** The remote list's HTTPS servers, or none when it cannot be fetched. */
export const fetchRemoteServers = async (deps: AppleDeps): Promise<AnisetteServer[]> => {
  const { config } = deps;
  try {
    const response = await fetchApple(deps, config.anisetteServerListUrl, { timeoutMs: config.timeouts.healthCheckMs });
    return httpsOnly(deps, serverListSchema.parse(JSON.parse(utf8Decode(response.body))).servers);
  } catch (error) {
    deps.logger.warn("anisette server list unavailable; using the built-in list", { cause: error });
    return [];
  }
};
