// Anisette v1: `GET /` returns a complete header set. Used by older servers and the local sidecar.

import type { AppleDeps } from "@apple/deps.ts";
import { ANISETTE_SERIAL_NUMBER } from "@apple/domain/anisette.ts";
import type { AnisetteServer, ClientIdentity } from "@apple/domain/config.ts";
import { nonEmpty } from "@apple/domain/values.ts";
import { fetchApple } from "@apple/infrastructure/http.ts";
import { compact, utf8Decode } from "@loadstar/kernel";
import { z } from "zod";

const v1Schema = z.looseObject({
  "X-Apple-I-MD": z.string(),
  "X-Apple-I-MD-M": z.string(),
  "X-Apple-I-MD-RINFO": z.union([z.string(), z.number()]).transform(String),
  "X-Apple-I-MD-LU": z.string(),
  "X-Mme-Device-Id": z.string(),
  "X-Apple-I-SRL-NO": z.union([z.string(), z.number()]).transform(String).optional(),
  "X-Mme-Client-Info": z.string().optional(),
  "X-Apple-I-Client-Time": z.string().optional(),
  "X-Apple-I-TimeZone": z.string().optional(),
  "X-Apple-Locale": z.string().optional(),
});

export interface V1Result {
  readonly headers: Record<string, string>;
  /** Present when the server reports the identity it impersonates. */
  readonly clientInfo?: string;
}

export const fetchV1 = async (deps: AppleDeps, server: AnisetteServer, timeoutMs?: number): Promise<V1Result> => {
  const response = await fetchApple(deps, `${server.address}/`, compact({ timeoutMs }));
  const data = v1Schema.parse(JSON.parse(utf8Decode(response.body)));
  const { "X-Mme-Client-Info": clientInfo, ...rest } = data;
  const headers: Record<string, string> = {};
  for (const [key, value] of Object.entries(rest)) if (typeof value === "string") headers[key] = value;
  headers["X-Apple-I-SRL-NO"] ??= ANISETTE_SERIAL_NUMBER;
  return compact({ headers, clientInfo: nonEmpty(clientInfo) });
};

export const identityFromV1 = (result: V1Result, fallback: ClientIdentity): ClientIdentity =>
  result.clientInfo ? { ...fallback, clientInfo: result.clientInfo } : fallback;
