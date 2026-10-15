import { ACCOUNT, FREE_TEAM, ipaFile, UDID } from "@installer/__tests__/fakes.ts";
import { createHarness, scripted } from "@installer/__tests__/harness.ts";
import { PromptKind } from "@installer/domain/prompts.ts";
import type { AppSource } from "@installer/domain/state.ts";
import { ErrorCode } from "@loadstar/kernel";
import { describe, expect, it } from "vitest";

const file = (name: string): AppSource => ({ kind: "file", file: ipaFile(name) });
const install = (apps: AppSource[]) => ({ udid: UDID, accountId: ACCOUNT, apps });

describe("installApps", () => {
  it("installs catalog apps and files in sequence with one sign-in and one certificate", async () => {
    const h = createHarness();
    const result = await h.engine.installApps(
      install([file("one.ipa"), { kind: "catalog", appId: "sidestore" }, file("two.ipa")]),
      { onPrompt: scripted() },
    ).result;
    expect(result.status).toBe("completed");
    expect(h.devices.calls.installs.map((f) => f.name)).toHaveLength(3);
    expect(h.apple.calls.created).toHaveLength(1);
    expect(h.signer.calls.signed.map((r) => r.newMainBundleId)).toEqual([
      `com.example.app.${FREE_TEAM.id}`,
      `com.SideStore.SideStore.${FREE_TEAM.id}`,
      `com.example.app.${FREE_TEAM.id}`,
    ]);
    // Only the checksum-verified catalog release gets the certificate.
    expect(h.signer.calls.signed.map((r) => r.additions !== undefined)).toEqual([false, true, false]);
    expect(h.signer.calls.bundles).toBe(0);
  });

  it("checks the App ID budget for every app before provisioning any of them", async () => {
    const h = createHarness({ apple: { appIdPlan: { enough: false, available: 1 } } });
    const result = await h.engine.installApps(install([file("one.ipa"), file("two.ipa")]), {
      onPrompt: scripted(),
    }).result;
    expect(result.status === "failed" && result.error.code).toBe(ErrorCode.AppIdQuotaExceeded);
    expect(h.apple.calls.provisioned).toEqual([]);
  });

  it.each([
    ["approves", true, { kind: "user-approved" }],
    ["declines", false, undefined],
  ])("asks before sharing the certificate with an imported SideStore; the user %s", async (_label, answer, trust) => {
    const h = createHarness({ signerIds: { "mine.ipa": "com.SideStore.SideStore" } });
    const prompts = scripted({ [PromptKind.ShareCertificate]: () => answer });
    const result = await h.engine.installApps(install([file("mine.ipa")]), { onPrompt: prompts }).result;
    expect(result.status).toBe("completed");
    expect(prompts.asked.map((p) => p.kind)).toEqual([PromptKind.ShareCertificate]);
    expect(result.status === "completed" && result.state.apps[0]?.trust).toEqual(trust);
    expect(h.signer.calls.signed[0]?.additions !== undefined).toBe(answer);
    expect(h.devices.calls.installs).toHaveLength(1);
  });

  it("does not ask when an imported IPA only claims a SideStore bundle ID without holding SideStore", async () => {
    // LiveContainer without the SideStore framework has nowhere to put the certificate.
    const h = createHarness({ signerIds: { "lc.ipa": "com.kdt.livecontainer" } });
    h.signer.signer.bundles = async () => [
      { path: "", kind: "app", identifier: "com.kdt.livecontainer", infoPlist: {}, executable: "x", depth: 0 } as never,
    ];
    const prompts = scripted();
    const result = await h.engine.installApps(install([file("lc.ipa")]), { onPrompt: prompts }).result;
    expect(result.status).toBe("completed");
    expect(prompts.asked).toEqual([]);
    expect(h.signer.calls.signed[0]?.additions).toBeUndefined();
  });

  it("refuses an empty list", () => {
    const h = createHarness();
    expect(() => h.engine.installApps(install([]))).toThrow();
  });
});
