// Anisette data from one server: v3 (provisioned on demand, state kept per server) or v1 (headers as served).

import type { AnisetteStateStore } from "@apple/application/anisette/state-store.ts";
import type { AppleDeps } from "@apple/deps.ts";
import { ANISETTE_IDENTIFIER_BYTES, type AnisetteData, type AnisetteState } from "@apple/domain/anisette.ts";
import type { AnisetteServer, ClientIdentity } from "@apple/domain/config.ts";
import { fetchV1, identityFromV1 } from "@apple/infrastructure/anisette/v1.ts";
import { completeHeaders, fetchClientInfo, getHeadersV3, provisionV3 } from "@apple/infrastructure/anisette/v3.ts";
import { ErrorCode, LoadstarError } from "@loadstar/kernel";

/** A rejected state is provisioned again once; a second rejection fails this server. */
const V3_ATTEMPTS = 2;

/** The identity the server impersonates, or the default one when it does not say. */
const identityFor = async (deps: AppleDeps, server: AnisetteServer): Promise<ClientIdentity> => {
  try {
    return await fetchClientInfo(deps, server);
  } catch (error) {
    deps.logger.debug("anisette server has no client_info; using the default identity", {
      server: server.name,
      cause: error,
    });
    return deps.config.defaultIdentity;
  }
};

const provisioned = async (
  deps: AppleDeps,
  states: AnisetteStateStore,
  server: AnisetteServer,
  state: AnisetteState,
  identity: ClientIdentity,
): Promise<AnisetteState & { readonly adiPb: Uint8Array }> => {
  if (state.adiPb) return { ...state, adiPb: state.adiPb };
  const ready = { ...state, adiPb: await provisionV3(deps, server, state.identifier, identity) };
  await states.save(server, ready);
  return ready;
};

export const fromV3 = async (
  deps: AppleDeps,
  states: AnisetteStateStore,
  server: AnisetteServer,
  signal?: AbortSignal,
): Promise<AnisetteData> => {
  const identity = await identityFor(deps, server);
  let state = (await states.load(server)) ?? { identifier: deps.randomBytes(ANISETTE_IDENTIFIER_BYTES) };
  for (let attempt = 0; attempt < V3_ATTEMPTS; attempt++) {
    signal?.throwIfAborted();
    const ready = await provisioned(deps, states, server, state, identity);
    const result = await getHeadersV3(deps, server, ready.identifier, ready.adiPb);
    if (result.kind === "headers") {
      return {
        headers: await completeHeaders(deps, ready.identifier, result.headers),
        identity,
        server: server.name,
        serverAddress: server.address,
      };
    }
    deps.logger.warn("anisette state rejected; provisioning again", { server: server.name, message: result.message });
    state = { identifier: ready.identifier };
  }
  throw new LoadstarError(ErrorCode.AnisetteNotProvisioned, { data: { server: server.name } });
};

export const fromV1 = async (deps: AppleDeps, server: AnisetteServer): Promise<AnisetteData> => {
  const result = await fetchV1(deps, server);
  return {
    headers: result.headers,
    identity: identityFromV1(result, deps.config.defaultIdentity),
    server: server.name,
    serverAddress: server.address,
  };
};
