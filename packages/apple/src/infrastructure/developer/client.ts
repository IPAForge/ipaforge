// Apple's developer services (the API Xcode uses for free and paid accounts): XML-plist requests authenticated
// with the Xcode app token, fresh anisette values on every request, `resultCode` 0 for success.

import type { AppleDeps } from "@apple/deps.ts";
import type { AnisetteData } from "@apple/domain/anisette.ts";
import { developerErrorCode } from "@apple/domain/developer.ts";
import { appleHeaders } from "@apple/infrastructure/gsa/client.ts";
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
} from "@loadstar/kernel";

export const DEVELOPER_BASE = "https://developerservices2.apple.com/services/QH65B2/";
export const DEVELOPER_CLIENT_ID = "XABBG36SBA";
export const DEVELOPER_PROTOCOL = "QH65B2";

/** `ios/` resources (devices, certificates, App IDs, …) or team-level actions (`listTeams`). */
export type DeveloperPlatform = "ios" | "any";

export interface DeveloperAuth {
  /** `com.apple.gs.xcode.auth` app token. */
  readonly token: string;
  readonly adsid: string;
}

export interface DeveloperRequestOptions {
  readonly anisette: () => Promise<AnisetteData>;
  readonly auth: () => Promise<DeveloperAuth>;
}

export const developerUrl = (action: string, platform: DeveloperPlatform): string =>
  `${DEVELOPER_BASE}${platform === "ios" ? "ios/" : ""}${action}.action?clientId=${DEVELOPER_CLIENT_ID}`;

const asNumber = (value: PlistValue | undefined): number | undefined =>
  typeof value === "number" ? value : typeof value === "bigint" ? Number(value) : undefined;

/** Sends one developer-API request and returns the response dict (throws a catalogued error on resultCode ≠ 0). */
export const developerRequest = async (
  deps: AppleDeps,
  options: DeveloperRequestOptions,
  action: string,
  platform: DeveloperPlatform,
  fields: readonly (readonly [string, PlistValue])[] = [],
): Promise<PlistDict> => {
  const [anisette, auth] = await Promise.all([options.anisette(), options.auth()]);
  const anisetteHeaders: Record<string, string> = {};
  for (const name of deps.config.cpdAnisetteHeaders) {
    const value = anisette.headers[name];
    if (value !== undefined) anisetteHeaders[name] = value;
  }
  const body = createDict([
    ["clientId", DEVELOPER_CLIENT_ID],
    ["protocolVersion", DEVELOPER_PROTOCOL],
    ["requestId", globalThis.crypto.randomUUID().toUpperCase()],
    ["userLocale", [deps.config.locale]],
    ...fields,
  ]);
  deps.logger.debug("developer request", { action, fields: fields.map(([key]) => key) });
  const response = await fetchApple(deps, developerUrl(action, platform), {
    method: "POST",
    headers: {
      ...appleHeaders(deps, anisette),
      ...anisetteHeaders,
      "Content-Type": "text/x-xml-plist",
      Accept: "text/x-xml-plist",
      "X-Apple-GS-Token": auth.token,
      "X-Apple-I-Identity-Id": auth.adsid,
    },
    body: serializeXmlPlist(body),
    acceptStatus: (status) => (status >= 200 && status < 300) || status === 401 || status === 403,
  });
  if (response.status === 401) throw new LoadstarError(ErrorCode.SessionExpired, { data: { action } });
  if (response.status === 403) {
    throw new LoadstarError(
      action === "listTeams" ? ErrorCode.NotEligibleForDevelopment : ErrorCode.DeveloperRequestFailed,
      {
        message: `developer services refused ${action} (HTTP 403)`,
        data: { action, status: 403 },
      },
    );
  }
  const value = parseApplePlist(response.body, `developer ${action}`);
  if (!isPlistDict(value)) throw new LoadstarError(ErrorCode.AppleProtocolError, { message: `${action}: not a dict` });
  const resultCode = asNumber(value.resultCode) ?? 0;
  if (resultCode !== 0) {
    const userString = typeof value.userString === "string" ? value.userString : undefined;
    const resultString = typeof value.resultString === "string" ? value.resultString : undefined;
    const message = userString ?? resultString ?? "";
    throw new LoadstarError(developerErrorCode(resultCode, message), {
      message: `${action} failed: ${resultCode} ${message}`.trim(),
      data: { action, resultCode, ...(message ? { appleMessage: message } : {}) },
    });
  }
  return value;
};
