// The second factor, as a small state machine the UI drives: pick a method, request a code (again if needed),
// submit it. Every "a code was already sent" answer goes straight to code entry; a wrong code re-prompts.

import type { AppleDeps } from "@apple/deps.ts";
import type { AnisetteData } from "@apple/domain/anisette.ts";
import { GsaCode, gsaErrorCode, isCodeAlreadySent } from "@apple/domain/gsa-status.ts";
import type { AppleSession, SecondFactorKind } from "@apple/domain/session.ts";
import { appleHeaders, statusOf } from "@apple/infrastructure/gsa/client.ts";
import { bagUrl } from "@apple/infrastructure/gsa/url-bag.ts";
import { fetchApple } from "@apple/infrastructure/http.ts";
import {
  createDict,
  ErrorCode,
  isPlistDict,
  LoadstarError,
  parsePlist,
  toBase64,
  utf8Decode,
  utf8Encode,
} from "@loadstar/kernel";
import { z } from "zod";

export interface TrustedPhone {
  readonly id: number;
  /** As Apple shows it, e.g. "+40 ••• ••• •12". */
  readonly number: string;
}

export interface TwoFactorMethods {
  readonly trustedDevice: boolean;
  readonly phones: readonly TrustedPhone[];
  /** Digits Apple expects (6 for current accounts, 4 for legacy ones). */
  readonly codeLength: number;
  /** Legacy two-step (`hsa`) account: codes go to a trusted device id. */
  readonly legacy: boolean;
  /** The account only has security keys, which Loadstar cannot use. */
  readonly securityKeysOnly: boolean;
}

export type TwoFactorMethod =
  | { readonly type: "trusted_device" }
  | { readonly type: "sms"; readonly phoneId: number }
  | { readonly type: "legacy_device"; readonly deviceId: string };

export interface TwoFactorChallenge {
  /** What Apple asked for first. */
  readonly requested: SecondFactorKind;
  methods(): Promise<TwoFactorMethods>;
  /** Sends (or re-sends) a code. "Already sent" answers count as success. */
  requestCode(method: TwoFactorMethod): Promise<void>;
  /**
   * Submits the code and finishes signing in. A wrong code throws `apple.two_factor_invalid_code` and the
   * challenge stays usable, so the UI simply asks again.
   */
  submitCode(method: TwoFactorMethod, code: string): Promise<AppleSession>;
}

const authStatusSchema = z.looseObject({
  trustedPhoneNumbers: z
    .array(
      z.looseObject({
        id: z.union([z.number(), z.string()]).transform(Number),
        numberWithDialCode: z.string().optional(),
        obfuscatedNumber: z.string().optional(),
      }),
    )
    .optional(),
  trustedDevices: z.array(z.looseObject({ id: z.union([z.string(), z.number()]).transform(String) })).optional(),
  securityCode: z.looseObject({ length: z.number().int().positive() }).optional(),
  authType: z.string().optional(),
  keyNames: z.array(z.string()).optional(),
  fsaChallenge: z.unknown().optional(),
  noTrustedDevices: z.boolean().optional(),
});

const serviceErrorsSchema = z.looseObject({
  service_errors: z.array(z.looseObject({ code: z.union([z.string(), z.number()]).transform(Number) })).optional(),
});

/** Apple's JSON error body → the first service error code, when present. */
const serviceErrorCode = (body: Uint8Array): number | undefined => {
  try {
    return serviceErrorsSchema.parse(JSON.parse(utf8Decode(body))).service_errors?.[0]?.code;
  } catch {
    return undefined;
  }
};

const DEFAULT_CODE_LENGTH = 6;

/** Anisette headers a 2FA request carries (the one-time values must be fresh for every request). */
const TWO_FACTOR_ANISETTE_HEADERS = ["X-Mme-Device-Id", "X-Apple-I-MD", "X-Apple-I-MD-M", "X-Apple-I-MD-RINFO"];

export const createTwoFactorChallenge = async (
  deps: AppleDeps,
  freshAnisette: () => Promise<AnisetteData>,
  session: AppleSession,
  requested: SecondFactorKind,
  finish: () => Promise<AppleSession>,
  options: { readonly codeAlreadySent?: boolean } = {},
): Promise<TwoFactorChallenge> => {
  const { endpoints } = deps.config;
  /** Headers for one 2FA request, with fresh one-time anisette values. */
  const headers = async (format: "plist" | "json"): Promise<Record<string, string>> => {
    const anisette = await freshAnisette();
    const picked: Record<string, string> = {};
    for (const name of TWO_FACTOR_ANISETTE_HEADERS) {
      const value = anisette.headers[name];
      if (value !== undefined) picked[name] = value;
    }
    const type = format === "json" ? "application/json" : "text/x-xml-plist";
    return {
      ...appleHeaders(deps, anisette),
      ...picked,
      "X-Apple-Identity-Token": toBase64(utf8Encode(`${session.adsid}:${session.idmsToken}`)),
      "Content-Type": type,
      Accept: type,
    };
  };

  let cachedMethods: TwoFactorMethods | undefined;

  const methods = async (): Promise<TwoFactorMethods> => {
    if (cachedMethods) return cachedMethods;
    const response = await fetchApple(deps, endpoints.authStatus, {
      headers: await headers("json"),
      acceptStatus: (status) => (status >= 200 && status < 300) || status === 403,
    });
    if (response.status === 403) {
      // Apple refuses the phone-number flow for this client (seen Oct 2026 across sideloading tools). Trusted
      // devices still work, so only fail when that is not an option.
      if (requested === "trusted_device") {
        cachedMethods = {
          trustedDevice: true,
          phones: [],
          codeLength: DEFAULT_CODE_LENGTH,
          legacy: false,
          securityKeysOnly: false,
        };
        return cachedMethods;
      }
      throw new LoadstarError(ErrorCode.SmsUnavailable, {
        message: "Apple refused the SMS verification flow for this sign-in",
        data: { status: 403, hint: "use_trusted_device_or_another_apple_id" },
      });
    }
    const status = authStatusSchema.parse(JSON.parse(utf8Decode(response.body)));
    const legacy = status.authType === "hsa";
    const phones = (status.trustedPhoneNumbers ?? []).map((phone) => ({
      id: phone.id,
      number: phone.numberWithDialCode ?? phone.obfuscatedNumber ?? String(phone.id),
    }));
    const securityKeysOnly = (status.keyNames?.length ?? 0) > 0 || status.fsaChallenge !== undefined;
    cachedMethods = {
      trustedDevice: requested === "trusted_device" || legacy,
      phones,
      codeLength: status.securityCode?.length ?? (legacy ? 4 : DEFAULT_CODE_LENGTH),
      legacy,
      securityKeysOnly: securityKeysOnly && phones.length === 0,
    };
    if (cachedMethods.securityKeysOnly) {
      throw new LoadstarError(ErrorCode.TwoFactorUnsupported, {
        message: "this Apple ID only allows security keys",
        data: { reason: "security_keys" },
      });
    }
    return cachedMethods;
  };

  const requestCode = async (method: TwoFactorMethod): Promise<void> => {
    if (method.type === "trusted_device" || method.type === "legacy_device") {
      await fetchApple(deps, await bagUrl(deps, "trustedDeviceSecondaryAuth", endpoints.trustedDevice), {
        headers: await headers("plist"),
        acceptStatus: (status) => (status >= 200 && status < 300) || status === 409,
      });
      return;
    }
    const response = await fetchApple(deps, endpoints.phoneVerify, {
      method: "PUT",
      headers: await headers("json"),
      body: JSON.stringify({ phoneNumber: { id: method.phoneId }, mode: "sms" }),
      // 412 with an active challenge and 409 both mean "a code is on its way".
      acceptStatus: (status) =>
        (status >= 200 && status < 300) || status === 403 || status === 409 || status === 412 || status === 423,
    });
    if (response.status === 403) {
      throw new LoadstarError(ErrorCode.SmsUnavailable, {
        message: "Apple refused to send an SMS code for this sign-in",
        data: { status: 403, hint: "use_trusted_device_or_another_apple_id" },
      });
    }
    if (response.status === 423) {
      const code = serviceErrorCode(response.body);
      throw new LoadstarError(code === GsaCode.SmsUnavailable ? ErrorCode.SmsUnavailable : ErrorCode.RateLimited, {
        data: { serviceError: code },
      });
    }
    const code = serviceErrorCode(response.body);
    if (code !== undefined && !isCodeAlreadySent({ ec: code })) {
      throw new LoadstarError(gsaErrorCode({ ec: code }), { data: { serviceError: code } });
    }
  };

  const submitCode = async (method: TwoFactorMethod, code: string): Promise<AppleSession> => {
    const trimmed = code.replace(/\s+/g, "");
    if (method.type === "trusted_device") {
      const response = await fetchApple(deps, await bagUrl(deps, "validateCode", endpoints.validateCode), {
        headers: { ...(await headers("plist")), "security-code": trimmed },
        acceptStatus: () => true,
        retryTransient: false,
      });
      const value = parsePlist(response.body);
      const status = statusOf(isPlistDict(value) ? value : createDict());
      if (status.ec !== 0 || response.status >= 400) {
        throw new LoadstarError(status.ec ? gsaErrorCode(status) : ErrorCode.TwoFactorInvalidCode, {
          data: { gsaCode: status.ec },
        });
      }
    } else {
      const url =
        method.type === "sms"
          ? endpoints.phoneSecurityCode
          : endpoints.legacyDeviceSecurityCode.replace("{deviceId}", encodeURIComponent(method.deviceId));
      const body =
        method.type === "sms"
          ? { securityCode: { code: trimmed }, phoneNumber: { id: method.phoneId }, mode: "sms" }
          : { securityCode: { code: trimmed } };
      const response = await fetchApple(deps, url, {
        method: "POST",
        headers: await headers("json"),
        body: JSON.stringify(body),
        acceptStatus: () => true,
        retryTransient: false,
      });
      if (response.status >= 400) {
        const serviceCode = serviceErrorCode(response.body);
        throw new LoadstarError(
          serviceCode === undefined ? ErrorCode.TwoFactorInvalidCode : gsaErrorCode({ ec: serviceCode }),
          { data: { status: response.status, ...(serviceCode === undefined ? {} : { serviceError: serviceCode }) } },
        );
      }
    }
    deps.logger.info("second factor accepted; completing sign-in", { method: method.type });
    return finish();
  };

  const challenge: TwoFactorChallenge = { requested, methods, requestCode, submitCode };
  // Ask Apple to push a code to trusted devices right away, unless it already did (hsc 409): a second push
  // would invalidate the code the user is looking at.
  if (requested === "trusted_device" && !options.codeAlreadySent) {
    await requestCode({ type: "trusted_device" }).catch((error: unknown) =>
      deps.logger.warn("could not trigger the trusted-device prompt", { cause: error }),
    );
  }
  return challenge;
};
