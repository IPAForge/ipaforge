// GrandSlam (GsService2): plist requests carrying the client-provided data (`cpd`) built from anisette.

import type { AppleDeps } from "@apple/deps.ts";
import type { AnisetteData } from "@apple/domain/anisette.ts";
import type { GsaStatus } from "@apple/domain/gsa-status.ts";
import { bagUrl } from "@apple/infrastructure/gsa/url-bag.ts";
import { fetchApple } from "@apple/infrastructure/http.ts";
import { parseApplePlist } from "@apple/infrastructure/plist-diagnostics.ts";
import {
  createDict,
  ErrorCode,
  isPlistDict,
  LoadstarError,
  type PlistDict,
  type PlistValue,
  serializeXmlPlist,
  toBase64,
} from "@loadstar/kernel";

/** `cpd`: the anisette headers plus the flags an Apple client sends with every GrandSlam request. */
export const clientProvidedData = (deps: AppleDeps, anisette: AnisetteData): PlistDict =>
  createDict([
    // Apple's own clients send these flags as strings.
    ["bootstrap", "true"],
    ["icscrec", "true"],
    ["loc", deps.config.locale],
    ["pbe", "false"],
    ["prkgen", "true"],
    ["svct", "iCloud"],
    ...deps.config.cpdAnisetteHeaders.flatMap((name) => {
      const value = anisette.headers[name];
      return value === undefined ? [] : [[name, value] as const];
    }),
  ]);

/** Base headers for every Apple request made on behalf of this client. */
export const appleHeaders = (deps: AppleDeps, anisette: AnisetteData): Record<string, string> => ({
  "User-Agent": anisette.identity.userAgent,
  "X-Mme-Client-Info": anisette.identity.clientInfo,
  "X-Xcode-Version": deps.config.xcode.xcodeVersion,
  "X-Apple-App-Info": deps.config.xcode.appInfo,
});

const asNumber = (value: PlistValue | undefined): number | undefined =>
  typeof value === "number" ? value : typeof value === "bigint" ? Number(value) : undefined;

export const statusOf = (response: PlistDict): GsaStatus => {
  const status = isPlistDict(response.Status) ? response.Status : createDict();
  const em = status.em;
  const au = status.au;
  const hsc = asNumber(status.hsc);
  const mdData = status["X-Apple-I-MD-DATA"];
  const resyncData = mdData instanceof Uint8Array ? toBase64(mdData) : typeof mdData === "string" ? mdData : undefined;
  return {
    ec: asNumber(status.ec) ?? 0,
    ...(typeof em === "string" ? { em } : {}),
    ...(hsc === undefined ? {} : { hsc }),
    ...(typeof au === "string" ? { au } : {}),
    ...(resyncData ? { resyncData } : {}),
  };
};

export interface GsaResponse {
  readonly response: PlistDict;
  readonly status: GsaStatus;
  readonly clockSkewMs?: number;
}

/** POSTs `{ Header: { Version }, Request }` to GsService2 and returns `Response` with its status. */
export const gsaRequest = async (
  deps: AppleDeps,
  anisette: AnisetteData,
  request: PlistDict,
  options: { readonly retryTransient?: boolean; readonly signal?: AbortSignal } = {},
): Promise<GsaResponse> => {
  const headers: Record<string, string> = {
    ...appleHeaders(deps, anisette),
    "Content-Type": "text/x-xml-plist",
    Accept: "text/x-xml-plist",
  };
  // Shape of the request (names and non-secret values only), for comparing with clients Apple accepts.
  deps.logger.debug("GSA request", {
    operation: request.o,
    headers: Object.keys(headers),
    clientInfo: headers["X-Mme-Client-Info"],
    userAgent: headers["User-Agent"],
    requestFields: Object.keys(request),
    cpdFields: isPlistDict(request.cpd) ? Object.keys(request.cpd) : [],
  });
  const result = await fetchApple(deps, await bagUrl(deps, "gsService", deps.config.endpoints.gsaService), {
    method: "POST",
    headers,
    body: serializeXmlPlist(
      createDict([
        ["Header", createDict([["Version", "1.0.1"]])],
        ["Request", request],
      ]),
    ),
    retryTransient: options.retryTransient ?? true,
    ...(options.signal ? { signal: options.signal } : {}),
  });
  const value = parseApplePlist(result.body, `GSA ${String(request.o)} response`);
  const response = isPlistDict(value) && isPlistDict(value.Response) ? value.Response : undefined;
  if (!response) throw new LoadstarError(ErrorCode.AppleProtocolError, { message: "GSA answered without a Response" });
  return {
    response,
    status: statusOf(response),
    ...(result.clockSkewMs === undefined ? {} : { clockSkewMs: result.clockSkewMs }),
  };
};
