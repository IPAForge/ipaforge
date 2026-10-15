// The second factor, as a small state machine the UI drives: pick a method, request a code (again if needed),
// submit it. Every "a code was already sent" answer goes straight to code entry; a wrong code re-prompts.

import type { AppleDeps } from "@apple/deps.ts";
import type { AnisetteData } from "@apple/domain/anisette.ts";
import { GsaCode, gsaErrorCode, isCodeAlreadySent } from "@apple/domain/gsa-status.ts";
import type { AppleSession, SecondFactorKind } from "@apple/domain/session.ts";
import {
  TRUSTED_DEVICE_ONLY,
  type TwoFactorMethod,
  type TwoFactorMethods,
  twoFactorMethods,
} from "@apple/domain/two-factor.ts";
import {
  appleHeaders,
  JSON_CONTENT_TYPE,
  PLIST_CONTENT_TYPE,
  pickHeaders,
} from "@apple/infrastructure/apple-headers.ts";
import { parseAuthStatus, serviceErrorCode } from "@apple/infrastructure/gsa/auth-status.ts";
import { statusOf } from "@apple/infrastructure/gsa/client.ts";
import { bagUrl } from "@apple/infrastructure/gsa/url-bag.ts";
import { fetchApple, successOr } from "@apple/infrastructure/http.ts";
import {
  compact,
  createDict,
  ErrorCode,
  isPlistDict,
  LoadstarError,
  parsePlist,
  toBase64,
  utf8Encode,
} from "@loadstar/kernel";

export type { TrustedPhone, TwoFactorMethod, TwoFactorMethods } from "@apple/domain/two-factor.ts";

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

/** Anisette headers a 2FA request carries (the one-time values must be fresh for every request). */
const TWO_FACTOR_ANISETTE_HEADERS = ["X-Mme-Device-Id", "X-Apple-I-MD", "X-Apple-I-MD-M", "X-Apple-I-MD-RINFO"];

const HTTP_FORBIDDEN = 403;
const HTTP_CONFLICT = 409;
const HTTP_PRECONDITION_FAILED = 412;
const HTTP_LOCKED = 423;
const HTTP_BAD_REQUEST = 400;

type BodyFormat = "plist" | "json";

/** What every 2FA request needs: the deps and headers with fresh one-time anisette values. */
interface TwoFactorContext {
  readonly deps: AppleDeps;
  readonly headers: (format: BodyFormat) => Promise<Record<string, string>>;
}

const twoFactorHeaders =
  (deps: AppleDeps, freshAnisette: () => Promise<AnisetteData>, session: AppleSession) =>
  async (format: BodyFormat): Promise<Record<string, string>> => {
    const anisette = await freshAnisette();
    const type = format === "json" ? JSON_CONTENT_TYPE : PLIST_CONTENT_TYPE;
    return {
      ...appleHeaders(deps, anisette),
      ...pickHeaders(anisette.headers, TWO_FACTOR_ANISETTE_HEADERS),
      "X-Apple-Identity-Token": toBase64(utf8Encode(`${session.adsid}:${session.idmsToken}`)),
      "Content-Type": type,
      Accept: type,
    };
  };

const smsRefused = (message: string): LoadstarError =>
  new LoadstarError(ErrorCode.SmsUnavailable, {
    message,
    data: { status: HTTP_FORBIDDEN, hint: "use_trusted_device_or_another_apple_id" },
  });

/** Apple's 2FA state for this sign-in. Throws when the account only allows security keys. */
const fetchMethods = async (ctx: TwoFactorContext, requested: SecondFactorKind): Promise<TwoFactorMethods> => {
  const response = await fetchApple(ctx.deps, ctx.deps.config.endpoints.authStatus, {
    headers: await ctx.headers("json"),
    acceptStatus: successOr(HTTP_FORBIDDEN),
  });
  if (response.status !== HTTP_FORBIDDEN) return twoFactorMethods(parseAuthStatus(response.body), requested);
  // Apple refuses the phone-number flow for this client (seen Oct 2026 across sideloading tools). Trusted
  // devices still work, so only fail when that is not an option.
  if (requested === "trusted_device") return TRUSTED_DEVICE_ONLY;
  throw smsRefused("Apple refused the SMS verification flow for this sign-in");
};

const assertUsable = (methods: TwoFactorMethods): void => {
  if (!methods.securityKeysOnly) return;
  throw new LoadstarError(ErrorCode.TwoFactorUnsupported, {
    message: "this Apple ID only allows security keys",
    data: { reason: "security_keys" },
  });
};

/** Asks Apple to push a code to the trusted devices. */
const requestDeviceCode = async (ctx: TwoFactorContext): Promise<void> => {
  const { endpoints } = ctx.deps.config;
  await fetchApple(ctx.deps, await bagUrl(ctx.deps, "trustedDeviceSecondaryAuth", endpoints.trustedDevice), {
    headers: await ctx.headers("plist"),
    acceptStatus: successOr(HTTP_CONFLICT),
  });
};

const requestSmsCode = async (ctx: TwoFactorContext, phoneId: number): Promise<void> => {
  const response = await fetchApple(ctx.deps, ctx.deps.config.endpoints.phoneVerify, {
    method: "PUT",
    headers: await ctx.headers("json"),
    body: JSON.stringify({ phoneNumber: { id: phoneId }, mode: "sms" }),
    // 412 with an active challenge and 409 both mean "a code is on its way".
    acceptStatus: successOr(HTTP_FORBIDDEN, HTTP_CONFLICT, HTTP_PRECONDITION_FAILED, HTTP_LOCKED),
  });
  if (response.status === HTTP_FORBIDDEN) throw smsRefused("Apple refused to send an SMS code for this sign-in");
  const code = serviceErrorCode(response.body);
  if (response.status === HTTP_LOCKED) {
    throw new LoadstarError(code === GsaCode.SmsUnavailable ? ErrorCode.SmsUnavailable : ErrorCode.RateLimited, {
      data: { serviceError: code },
    });
  }
  if (code !== undefined && !isCodeAlreadySent({ ec: code })) {
    throw new LoadstarError(gsaErrorCode({ ec: code }), { data: { serviceError: code } });
  }
};

/** Trusted-device codes are checked by GrandSlam, which answers with a plist status. */
const submitDeviceCode = async (ctx: TwoFactorContext, code: string): Promise<void> => {
  const { endpoints } = ctx.deps.config;
  const response = await fetchApple(ctx.deps, await bagUrl(ctx.deps, "validateCode", endpoints.validateCode), {
    headers: { ...(await ctx.headers("plist")), "security-code": code },
    acceptStatus: () => true,
    retryTransient: false,
  });
  const value = parsePlist(response.body);
  const status = statusOf(isPlistDict(value) ? value : createDict());
  if (status.ec === 0 && response.status < HTTP_BAD_REQUEST) return;
  throw new LoadstarError(status.ec ? gsaErrorCode(status) : ErrorCode.TwoFactorInvalidCode, {
    data: { gsaCode: status.ec },
  });
};

/** SMS and legacy-device codes go to the JSON endpoints. */
const phoneCodeRequest = (
  ctx: TwoFactorContext,
  method: Exclude<TwoFactorMethod, { type: "trusted_device" }>,
  code: string,
): { url: string; body: unknown } => {
  const { endpoints } = ctx.deps.config;
  if (method.type === "sms") {
    return {
      url: endpoints.phoneSecurityCode,
      body: { securityCode: { code }, phoneNumber: { id: method.phoneId }, mode: "sms" },
    };
  }
  return {
    url: endpoints.legacyDeviceSecurityCode.replace("{deviceId}", encodeURIComponent(method.deviceId)),
    body: { securityCode: { code } },
  };
};

const submitPhoneCode = async (
  ctx: TwoFactorContext,
  method: Exclude<TwoFactorMethod, { type: "trusted_device" }>,
  code: string,
): Promise<void> => {
  const { url, body } = phoneCodeRequest(ctx, method, code);
  const response = await fetchApple(ctx.deps, url, {
    method: "POST",
    headers: await ctx.headers("json"),
    body: JSON.stringify(body),
    acceptStatus: () => true,
    retryTransient: false,
  });
  if (response.status < HTTP_BAD_REQUEST) return;
  const serviceCode = serviceErrorCode(response.body);
  throw new LoadstarError(
    serviceCode === undefined ? ErrorCode.TwoFactorInvalidCode : gsaErrorCode({ ec: serviceCode }),
    { data: compact({ status: response.status, serviceError: serviceCode }) },
  );
};

export const createTwoFactorChallenge = async (
  deps: AppleDeps,
  freshAnisette: () => Promise<AnisetteData>,
  session: AppleSession,
  requested: SecondFactorKind,
  finish: () => Promise<AppleSession>,
  options: { readonly codeAlreadySent?: boolean } = {},
): Promise<TwoFactorChallenge> => {
  const ctx: TwoFactorContext = { deps, headers: twoFactorHeaders(deps, freshAnisette, session) };
  let cachedMethods: TwoFactorMethods | undefined;

  const methods = async (): Promise<TwoFactorMethods> => {
    if (cachedMethods) return cachedMethods;
    cachedMethods = await fetchMethods(ctx, requested);
    assertUsable(cachedMethods);
    return cachedMethods;
  };

  const requestCode = (method: TwoFactorMethod): Promise<void> =>
    method.type === "sms" ? requestSmsCode(ctx, method.phoneId) : requestDeviceCode(ctx);

  const submitCode = async (method: TwoFactorMethod, code: string): Promise<AppleSession> => {
    const trimmed = code.replace(/\s+/g, "");
    if (method.type === "trusted_device") await submitDeviceCode(ctx, trimmed);
    else await submitPhoneCode(ctx, method, trimmed);
    deps.logger.info("second factor accepted; completing sign-in", { method: method.type });
    return finish();
  };

  const challenge: TwoFactorChallenge = { requested, methods, requestCode, submitCode };
  // Ask Apple to push a code to trusted devices right away, unless it already did (hsc 409): a second push
  // would invalidate the code the user is looking at.
  if (requested === "trusted_device" && !options.codeAlreadySent) {
    await requestDeviceCode(ctx).catch((error: unknown) =>
      deps.logger.warn("could not trigger the trusted-device prompt", { cause: error }),
    );
  }
  return challenge;
};
