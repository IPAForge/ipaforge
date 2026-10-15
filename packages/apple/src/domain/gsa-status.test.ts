import { gsaErrorCode, needsAnisetteResync } from "@apple/domain/gsa-status.ts";
import { statusOf } from "@apple/infrastructure/gsa/client.ts";
import { createDict, ErrorCode } from "@loadstar/kernel";
import { describe, expect, it } from "vitest";

describe("GSA status classification", () => {
  it.each([
    [-80045, ErrorCode.ClientRejected],
    [-90010, ErrorCode.ClientRejected],
    [-22421, ErrorCode.AccountRefused],
    [-22411, ErrorCode.AccountRefused],
    [-22406, ErrorCode.InvalidCredentials],
    [-20970, ErrorCode.InvalidCredentials],
    [-21669, ErrorCode.TwoFactorInvalidCode],
    [-28248, ErrorCode.SmsUnavailable],
    [-45061, ErrorCode.AnisetteNotProvisioned],
    [-1, ErrorCode.AppleProtocolError],
  ])("%i → %s", (ec, code) => expect(gsaErrorCode({ ec })).toBe(code));

  it("recognises a locked account by its message", () => {
    expect(gsaErrorCode({ ec: -1, em: "This Apple Account has been locked for security reasons." })).toBe(
      ErrorCode.AccountLocked,
    );
  });
});

describe("anisette resync (hsc 434)", () => {
  it("reads X-Apple-I-MD-DATA from the status and asks for a resync", () => {
    const status = statusOf(
      createDict([
        [
          "Status",
          createDict([
            ["ec", -22421],
            ["hsc", 434],
            ["X-Apple-I-MD-DATA", new Uint8Array([1, 2, 3])],
          ]),
        ],
      ]),
    );
    expect(needsAnisetteResync(status)).toBe(true);
    expect(status.resyncData).toBe("AQID");
    expect(needsAnisetteResync({ ec: -22421, hsc: 434 })).toBe(false);
    expect(needsAnisetteResync({ ec: 0 })).toBe(false);
  });
});
