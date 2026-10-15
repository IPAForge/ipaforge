import {
  type AppId,
  developerErrorCode,
  isUsableCertificate,
  normalizeAppIdName,
  planAppIds,
} from "@apple/domain/developer.ts";
import { createDict, ErrorCode } from "@loadstar/kernel";
import { describe, expect, it } from "vitest";

const now = new Date("2026-10-15T12:00:00Z");
const appId = (identifier: string, expiresAt?: string): AppId => ({
  id: `id-${identifier}`,
  identifier,
  name: identifier,
  features: createDict(),
  ...(expiresAt ? { expiresAt: new Date(expiresAt) } : {}),
});

describe("App ID names", () => {
  it("keeps only ASCII letters and digits and never returns an empty name", () => {
    expect(normalizeAppIdName("Play! Store 2")).toBe("PlayStore2");
    expect(normalizeAppIdName("Café ☕")).toBe("Caf");
    expect(normalizeAppIdName("🚀")).toBe("App");
  });
});

describe("App ID budget", () => {
  it("reuses existing identifiers and counts only new ones against the quota", () => {
    const existing = [
      appId("com.a.T"),
      appId("com.b.T", "2026-10-20T00:00:00Z"),
      appId("com.c.T", "2026-10-17T00:00:00Z"),
    ];
    const plan = planAppIds(["com.a.T", "com.a.T.Widget", "com.a.T.Share"], existing, { max: 10, available: 2 }, now);
    expect(plan.reuse.map((entry) => entry.identifier)).toEqual(["com.a.T"]);
    expect(plan.create).toEqual(["com.a.T.Widget", "com.a.T.Share"]);
    expect(plan.enough).toBe(true);
    expect(plan.nextSlotAt?.toISOString()).toBe("2026-10-17T00:00:00.000Z");
  });

  it("says when the quota is not enough (LiveContainer + SideStore needs 5)", () => {
    const wanted = ["main", "LiveProcess", "LiveWidget", "LaunchAppExtensionHelper", "LaunchAppExtension"].map(
      (suffix) => `com.kdt.livecontainer.T.${suffix}`,
    );
    const plan = planAppIds(wanted, [], { max: 10, available: 3 }, now);
    expect(plan.create).toHaveLength(5);
    expect(plan.enough).toBe(false);
  });
});

describe("developer result codes", () => {
  it.each([
    [35, "", ErrorCode.InvalidAppIdName],
    [1100, "", ErrorCode.SessionExpired],
    [1102, "", ErrorCode.NotEligibleForDevelopment],
    [2160, "", ErrorCode.EmailUnverified],
    [4550, "", ErrorCode.TeamAgreementRequired],
    [7460, "", ErrorCode.CertificateLimit],
    [7252, "", ErrorCode.CertificateNotRevocable],
    [7475, "", ErrorCode.CertificateNotRevocable],
    [8220, "", ErrorCode.NoDevicesForProfile],
    [9401, "", ErrorCode.AppIdUnavailable],
    [
      3013,
      "You may only register 10 App IDs every 7 days. Not enough available app IDs.",
      ErrorCode.AppIdQuotaExceeded,
    ],
    [
      9999,
      "You already have a current iOS Development certificate or a pending certificate request.",
      ErrorCode.CertificateLimit,
    ],
    [1, "", ErrorCode.DeveloperRequestFailed],
  ])("%i %s → %s", (code, message, expected) => expect(developerErrorCode(code, message)).toBe(expected));
});

describe("certificate reuse", () => {
  it("reuses only valid iOS certificates", () => {
    expect(isUsableCertificate({ serialNumber: "1", platform: "ios", expiresAt: new Date("2027-01-01") }, now)).toBe(
      true,
    );
    expect(isUsableCertificate({ serialNumber: "1", platform: "mac" }, now)).toBe(false);
    expect(isUsableCertificate({ serialNumber: "1", expiresAt: new Date("2026-01-01") }, now)).toBe(false);
    expect(isUsableCertificate({ serialNumber: "1", status: "Revoked" }, now)).toBe(false);
  });
});
