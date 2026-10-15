import { ACCOUNT, FREE_TEAM, installedApp, ipaFile, OTHER_TEAM, profile, UDID } from "@installer/__tests__/fakes.ts";
import { createHarness } from "@installer/__tests__/harness.ts";
import { ErrorCode } from "@loadstar/kernel";
import { describe, expect, it } from "vitest";

describe("engine queries", () => {
  it("previews an install without writing to Apple or the device", async () => {
    const h = createHarness({
      device: {
        profiles: [profile("P1", FREE_TEAM.id, "com.a")],
        installed: new Map([["com.a", installedApp("com.a")]]),
      },
      signerIds: { "mine.ipa": "com.SideStore.SideStore" },
    });
    const plan = await h.engine.planInstall({
      udid: UDID,
      accountId: ACCOUNT,
      source: { kind: "file", file: ipaFile("mine.ipa") },
    });
    expect(plan.identity.newMainBundleId).toBe(`com.SideStore.SideStore.${FREE_TEAM.id}`);
    expect(plan.appIds.create).toEqual([plan.identity.newMainBundleId]);
    expect(plan.freeSlots).toEqual({ occupied: [{ bundleId: "com.a" }], limit: 3 });
    expect(plan.certificate).toEqual({ stored: false, reusable: false, onTeam: 0 });
    expect(plan.sharesCertificate).toBe(true);
    expect(h.apple.calls.created).toEqual([]);
    expect(h.apple.calls.registered).toEqual([]);
    expect(h.apple.calls.provisioned).toEqual([]);
    expect(h.devices.calls.uninstalled).toEqual([]);
    expect(h.devices.calls.closed).toBe(1);
  });

  it("never asks for a team: an open choice is installer.team_required", async () => {
    const h = createHarness({ apple: { teams: [FREE_TEAM, OTHER_TEAM] } });
    await expect(h.engine.appIdQuota({ accountId: ACCOUNT })).rejects.toMatchObject({ code: ErrorCode.TeamRequired });
    const usage = await h.engine.appIdQuota({ accountId: ACCOUNT, teamId: OTHER_TEAM.id });
    expect(usage.team).toEqual(OTHER_TEAM);
    expect(usage.quota.available).toBe(10);
  });
});
