import { fakeProfile } from "@device/__tests__/fake-device/fake-device.ts";
import { developerModeState } from "@device/application/checks.ts";
import { parseVersion, shortUdid } from "@device/domain/device.ts";
import { decodePem, encodePem } from "@device/domain/pairing/pem.ts";
import { bundleIdOf, staleProfiles, summarizeProfile } from "@device/domain/profiles.ts";
import { utf8Encode } from "@loadstar/kernel";
import { describe, expect, it } from "vitest";

describe("device helpers", () => {
  it("parses versions and shortens UDIDs", () => {
    expect(parseVersion("17.4.1")).toEqual([17, 4, 1]);
    expect(parseVersion("18")).toEqual([18, 0, 0]);
    expect(shortUdid("00008110-001A2B3C4D5E6F70")).toBe("…6F70");
  });

  it("classifies Developer Mode", () => {
    expect(developerModeState("15.8", undefined)).toBe("not_required");
    expect(developerModeState("16.0", true)).toBe("on");
    expect(developerModeState("17.1", false)).toBe("off");
    expect(developerModeState("18.0", undefined)).toBe("unknown");
  });
});

describe("PEM", () => {
  it("round-trips and wraps at 64 columns", () => {
    const der = new Uint8Array(100).map((_, i) => i);
    const pem = encodePem("CERTIFICATE", der);
    expect(pem.split("\n")[1]).toHaveLength(64);
    expect(decodePem(utf8Encode(pem))).toEqual({ label: "CERTIFICATE", der });
  });
});

describe("profiles", () => {
  const later = new Date("2026-11-01T00:00:00Z");

  it("summarizes the plist inside a signed profile", () => {
    const raw = fakeProfile({ uuid: "U1", name: "App", teamId: "TEAM1", bundleId: "com.app", expires: later });
    expect(summarizeProfile(raw)).toMatchObject({
      uuid: "U1",
      name: "App",
      teamId: "TEAM1",
      applicationIdentifier: "TEAM1.com.app",
      expirationDate: later,
    });
    expect(summarizeProfile(utf8Encode("garbage"))).toBeUndefined();
    expect(bundleIdOf("TEAM1.com.app.widget")).toBe("com.app.widget");
  });

  it("selects expired profiles and the team's profiles for removed apps, never wildcards", () => {
    const now = new Date("2026-10-15T00:00:00Z");
    const profiles = [
      { uuid: "expired", teamId: "T", bundleId: "a", expires: new Date("2026-10-01T00:00:00Z") },
      { uuid: "unused", teamId: "T", bundleId: "gone", expires: later },
      { uuid: "used", teamId: "T", bundleId: "kept", expires: later },
      { uuid: "wildcard", teamId: "T", bundleId: "*", expires: later },
      { uuid: "other", teamId: "X", bundleId: "gone", expires: later },
    ].map((p) => summarizeProfile(fakeProfile({ ...p, name: p.uuid })) ?? (undefined as never));
    expect(staleProfiles(profiles, new Set(["kept"]), { now, teamId: "T" }).map((p) => p.uuid)).toEqual([
      "expired",
      "unused",
    ]);
    expect(staleProfiles(profiles, new Set(), { now }).map((p) => p.uuid)).toEqual(["expired"]);
  });
});
