// Apple ID sign-in: SRP against GrandSlam, then (when Apple asks) a second factor. Wrong passwords are never
// retried automatically, so the user cannot be locked out by the app.

import type { AnisetteService } from "@apple/application/anisette.ts";
import { createTwoFactorChallenge, type TwoFactorChallenge } from "@apple/application/two-factor.ts";
import type { AppleDeps } from "@apple/deps.ts";
import type { AnisetteData } from "@apple/domain/anisette.ts";
import { assertGsaOk, GsaCode, needsAnisetteResync } from "@apple/domain/gsa-status.ts";
import {
  type AppleSession,
  normalizeAppleId,
  type SecondFactorRequest,
  secondFactorFromStatus,
} from "@apple/domain/session.ts";
import { decryptSpd } from "@apple/infrastructure/crypto/session.ts";
import {
  bigintFromBytes,
  bytesFromBigint,
  clientEphemeral,
  clientProof,
  type PasswordProtocol,
  passwordKey,
  serverProof,
} from "@apple/infrastructure/crypto/srp.ts";
import { clientProvidedData, gsaRequest } from "@apple/infrastructure/gsa/client.ts";
import { parseApplePlist } from "@apple/infrastructure/plist-diagnostics.ts";
import {
  createDict,
  ErrorCode,
  equalBytes,
  fromBase64,
  isPlistDict,
  LoadstarError,
  type PlistDict,
  type PlistValue,
} from "@loadstar/kernel";

export type SignInResult =
  | { readonly kind: "signed_in"; readonly session: AppleSession }
  | { readonly kind: "two_factor"; readonly challenge: TwoFactorChallenge };

export interface SignInInput {
  readonly appleId: string;
  readonly password: string;
  readonly signal?: AbortSignal;
}

const PROTOCOLS: readonly PasswordProtocol[] = ["s2k", "s2k_fo"];

const bytesField = (dict: PlistDict, key: string): Uint8Array => {
  const value = dict[key];
  if (value instanceof Uint8Array) return value;
  if (typeof value === "string") return fromBase64(value);
  throw new LoadstarError(ErrorCode.AppleProtocolError, { message: `GSA response has no ${key}` });
};

const stringField = (dict: PlistDict, key: string): string => {
  const value = dict[key];
  if (typeof value !== "string") throw new LoadstarError(ErrorCode.AppleProtocolError, { message: `missing ${key}` });
  return value;
};

const numberField = (value: PlistValue | undefined): number | undefined =>
  typeof value === "number" ? value : typeof value === "bigint" ? Number(value) : undefined;

/** Attaches a clock-skew diagnosis when the computer's clock is far from Apple's. */
const checkSkew = (deps: AppleDeps, skewMs: number | undefined, error: LoadstarError): LoadstarError => {
  if (skewMs === undefined || Math.abs(skewMs) <= deps.config.maxClockSkewMs) return error;
  return new LoadstarError(ErrorCode.ClockSkew, { cause: error, data: { skewSeconds: Math.round(skewMs / 1000) } });
};

type Resync = (data: AnisetteData, resyncData: string) => Promise<AnisetteData>;

/** One SRP round trip. Returns the decrypted session data and the second-factor requirement, if any. */
const authenticate = async (
  deps: AppleDeps,
  initialAnisette: AnisetteData,
  resync: Resync,
  appleId: string,
  password: string,
  signal?: AbortSignal,
): Promise<{ session: AppleSession; secondFactor?: SecondFactorRequest }> => {
  let anisette = initialAnisette;
  const ephemeral = clientEphemeral(deps.randomBytes);
  const sendInit = () =>
    gsaRequest(
      deps,
      anisette,
      createDict([
        ["A2k", bytesFromBigint(ephemeral.A)],
        ["cpd", clientProvidedData(deps, anisette)],
        ["o", "init"],
        ["ps", [...PROTOCOLS]],
        ["u", appleId],
      ]),
      signal ? { signal } : {},
    );
  let init = await sendInit();
  // hsc 434: Apple wants this machine's anisette resynced first (catalogue). Resync once, then retry.
  if (needsAnisetteResync(init.status)) {
    deps.logger.info("Apple asked for an anisette resync; resyncing and retrying", { server: anisette.server });
    anisette = await resync(anisette, init.status.resyncData);
    init = await sendInit();
  }
  try {
    assertGsaOk(init.status, "init");
  } catch (error) {
    throw checkSkew(deps, init.clockSkewMs, error as LoadstarError);
  }
  const cpd = clientProvidedData(deps, anisette);

  const protocol = init.response.sp === "s2k_fo" ? "s2k_fo" : "s2k";
  const iterations = numberField(init.response.i);
  if (!iterations) throw new LoadstarError(ErrorCode.AppleProtocolError, { message: "GSA init: no iteration count" });
  const salt = bytesField(init.response, "s");
  const B = bigintFromBytes(bytesField(init.response, "B"));
  const key = await passwordKey(password, salt, iterations, protocol);
  const { M1, K } = await clientProof({ username: appleId, salt, passwordKey: key, ephemeral, B });

  // The password proof is never retried: a transient failure here must not count as extra wrong attempts.
  const complete = await gsaRequest(
    deps,
    anisette,
    createDict([
      ["M1", M1],
      ["c", init.response.c ?? ""],
      ["cpd", cpd],
      ["o", "complete"],
      ["u", appleId],
    ]),
    { retryTransient: false, ...(signal ? { signal } : {}) },
  );
  try {
    assertGsaOk(complete.status, "complete");
  } catch (error) {
    throw checkSkew(deps, complete.clockSkewMs, error as LoadstarError);
  }

  const M2 = bytesField(complete.response, "M2");
  if (!equalBytes(M2, await serverProof(ephemeral.A, M1, K))) {
    throw new LoadstarError(ErrorCode.AppleProtocolError, { message: "GSA server proof did not verify" });
  }
  const spd = parseApplePlist(await decryptSpd(K, bytesField(complete.response, "spd")), "session data (spd)");
  if (!isPlistDict(spd))
    throw new LoadstarError(ErrorCode.AppleProtocolError, { message: "session data is not a dict" });

  const firstName = spd.fn;
  const lastName = spd.ln;
  const session: AppleSession = {
    appleId,
    adsid: stringField(spd, "adsid"),
    idmsToken: stringField(spd, "GsIdmsToken"),
    sessionKey: bytesField(spd, "sk"),
    cookie: bytesField(spd, "c"),
    anisetteServer: anisette.server,
    ...(typeof firstName === "string" ? { firstName } : {}),
    ...(typeof lastName === "string" ? { lastName } : {}),
  };
  deps.logger.debug("GSA complete status", {
    ec: complete.status.ec,
    hsc: complete.status.hsc,
    au: complete.status.au,
  });
  const secondFactor = secondFactorFromStatus(complete.status);
  return secondFactor ? { session, secondFactor } : { session };
};

export interface SignInService {
  signIn(input: SignInInput): Promise<SignInResult>;
}

export const createSignInService = (deps: AppleDeps, anisette: AnisetteService): SignInService => {
  const signIn = async (input: SignInInput): Promise<SignInResult> => {
    const appleId = normalizeAppleId(input.appleId);
    const data = await anisette.get(input.signal ? { signal: input.signal } : {});
    let result: Awaited<ReturnType<typeof authenticate>>;
    try {
      result = await authenticate(deps, data, anisette.resync, appleId, input.password, input.signal);
    } catch (error) {
      // The machine identity went stale: re-provision once and try again (catalogue: -45061).
      if (error instanceof LoadstarError && error.data?.gsaCode === GsaCode.AnisetteNotProvisioned) {
        deps.logger.warn("anisette not provisioned for Apple; resetting it", { server: data.server });
        await anisette.reset();
        const fresh = await anisette.get(input.signal ? { signal: input.signal } : {});
        result = await authenticate(deps, fresh, anisette.resync, appleId, input.password, input.signal);
      } else {
        throw error;
      }
    }
    deps.logger.info("password accepted", {
      secondFactor: result.secondFactor?.kind ?? "none",
      codeAlreadySent: result.secondFactor?.codeAlreadySent ?? false,
    });
    if (!result.secondFactor) return { kind: "signed_in", session: result.session };
    return {
      kind: "two_factor",
      challenge: await createTwoFactorChallenge(
        deps,
        () => anisette.get(),
        result.session,
        result.secondFactor.kind,
        () =>
          signIn(input).then((retry) => {
            if (retry.kind === "signed_in") return retry.session;
            throw new LoadstarError(ErrorCode.TwoFactorRequired, { message: "Apple still asks for a second factor" });
          }),
        { codeAlreadySent: result.secondFactor.codeAlreadySent },
      ),
    };
  };
  return { signIn };
};
