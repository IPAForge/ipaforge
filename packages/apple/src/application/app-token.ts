// App tokens: short-lived tokens for Apple services (e.g. `com.apple.gs.xcode.auth` for developer services),
// requested with the signed-in session and decrypted with its session key.

import type { AnisetteService } from "@apple/application/anisette.ts";
import type { AppleDeps } from "@apple/deps.ts";
import { assertGsaOk } from "@apple/domain/gsa-status.ts";
import type { AppleSession, AppToken } from "@apple/domain/session.ts";
import { decryptAppToken, hmacSha256 } from "@apple/infrastructure/crypto/session.ts";
import { clientProvidedData, gsaRequest } from "@apple/infrastructure/gsa/client.ts";
import {
  createDict,
  ErrorCode,
  isPlistDict,
  LoadstarError,
  type PlistValue,
  parsePlist,
  utf8Encode,
} from "@loadstar/kernel";

export const XCODE_APP = "com.apple.gs.xcode.auth";

/** Renew a cached token this long before it expires. */
const EXPIRY_MARGIN_MS = 60_000;

const numberOf = (value: PlistValue | undefined): number | undefined =>
  typeof value === "number" ? value : typeof value === "bigint" ? Number(value) : undefined;

export interface AppTokenService {
  appToken(session: AppleSession, app?: string): Promise<AppToken>;
}

export const createAppTokenService = (deps: AppleDeps, anisette: AnisetteService): AppTokenService => {
  const cache = new Map<string, AppToken>();
  return {
    appToken: async (session, app = XCODE_APP) => {
      const key = `${session.adsid}/${app}`;
      const cached = cache.get(key);
      if (cached && cached.expiresAt.getTime() - EXPIRY_MARGIN_MS > deps.clock.now().getTime()) return cached;

      const data = await anisette.get();
      const checksum = await hmacSha256(session.sessionKey, utf8Encode(`apptokens${session.adsid}${app}`));
      const { response, status } = await gsaRequest(
        deps,
        data,
        createDict([
          ["app", [app]],
          ["c", session.cookie],
          ["checksum", checksum],
          ["cpd", clientProvidedData(deps, data)],
          ["o", "apptokens"],
          ["t", session.idmsToken],
          ["u", session.adsid],
        ]),
      );
      if (status.ec !== 0 && status.hsc === 401) throw new LoadstarError(ErrorCode.SessionExpired);
      assertGsaOk(status, "apptokens");
      const et = response.et;
      if (!(et instanceof Uint8Array)) throw new LoadstarError(ErrorCode.AppleProtocolError, { message: "no et" });
      const plain = parsePlist(await decryptAppToken(session.sessionKey, et));
      const tokens = isPlistDict(plain) && isPlistDict(plain.t) ? plain.t : undefined;
      const entry = tokens?.[app];
      if (!isPlistDict(entry) || typeof entry.token !== "string") {
        throw new LoadstarError(ErrorCode.AppleProtocolError, { message: `no token for ${app}` });
      }
      const expiryMs = numberOf(entry.expiry);
      const durationSeconds = numberOf(entry.duration) ?? 0;
      const token: AppToken = {
        app,
        token: entry.token,
        expiresAt: new Date(expiryMs ?? deps.clock.now().getTime() + durationSeconds * 1000),
      };
      cache.set(key, token);
      return token;
    },
  };
};
