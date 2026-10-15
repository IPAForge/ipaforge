import { addApp, createFakeDevice, fakeProfile } from "@device/__tests__/fake-device/fake-device.ts";
import { createRig } from "@device/__tests__/setup.ts";
import type { PairingProgress } from "@device/application/pair.ts";
import { pairRecordSecretKey } from "@device/application/pair.ts";
import { parsePairRecord } from "@device/domain/pairing/pair-record.ts";
import { decodePem } from "@device/domain/pairing/pem.ts";
import { bytesFileSource, ErrorCode, LoadstarError, parsePlist, utf8Encode } from "@loadstar/kernel";
import { describe, expect, it } from "vitest";

const codeOf = async (promise: Promise<unknown>): Promise<string | undefined> => {
  try {
    await promise;
  } catch (error) {
    if (error instanceof LoadstarError) return error.code;
    throw error;
  }
  return undefined;
};

describe("devices", () => {
  it("lists devices and prefers USB over Wi-Fi for the same device", async () => {
    const rig = await createRig();
    rig.fake.devices.push(await createFakeDevice({ udid: rig.device.udid, deviceId: 9, connectionType: "Network" }));
    const devices = await rig.manager.listDevices();
    expect(devices).toEqual([{ udid: rig.device.udid, deviceId: 7, connectionType: "usb" }]);
  });

  it("reports a missing usbmuxd with its own code", async () => {
    const rig = await createRig();
    rig.fake.unavailable = true;
    expect(await codeOf(rig.manager.listDevices())).toBe(ErrorCode.UsbmuxdUnavailable);
  });

  it("reports an unknown device", async () => {
    const rig = await createRig();
    expect(await codeOf(rig.manager.open("nope"))).toBe(ErrorCode.DeviceNotFound);
  });

  it("streams attach and detach events until aborted", async () => {
    const rig = await createRig();
    const events: string[] = [];
    const controller = new AbortController();
    const watching = rig.manager.watch((event) => {
      events.push(event.kind === "attached" ? `+${event.device.udid}` : `-${event.udid ?? event.deviceId}`);
      if (events.length === 3) controller.abort();
    }, controller.signal);
    await new Promise((resolve) => setTimeout(resolve, 5));
    const second = await createFakeDevice({ udid: "SECOND", deviceId: 8 });
    rig.fake.attach(second);
    await new Promise((resolve) => setTimeout(resolve, 5));
    rig.fake.detach("SECOND");
    await watching;
    expect(events).toEqual([`+${rig.device.udid}`, "+SECOND", "-SECOND"]);
  });
});

describe("pairing and sessions", () => {
  it("pairs on first use, waiting for Trust, and saves the record to usbmuxd", async () => {
    const rig = await createRig({ pendingPolls: 2 });
    const progress: PairingProgress[] = [];
    const handle = await rig.manager.open(rig.device.udid, { onProgress: (event) => progress.push(event) });
    expect(progress.map((event) => event.stage)).toEqual(["waiting_for_trust", "waiting_for_trust", "paired"]);
    expect(rig.sleeps).toEqual([1000, 1000]);

    const saved = rig.fake.pairRecords.get(rig.device.udid);
    expect(saved).toBeDefined();
    const record = parsePairRecord(saved as Uint8Array);
    expect(record.systemBuid).toBe(rig.fake.buid);
    expect(record.udid).toBe(rig.device.udid);
    expect(record.wifiMacAddress).toBe("aa:bb:cc:dd:ee:ff");

    // The session was upgraded to TLS with the host credentials, pinning the device certificate.
    const tls = rig.device.tlsUpgrades[0];
    expect(tls?.expectedPeerCertificate).toEqual(decodePem(record.deviceCertificate).der);
    expect(tls?.certificatePem).toContain("BEGIN CERTIFICATE");
    await handle.close();
    expect(rig.device.requests).toContain("lockdown:StopSession");
  });

  it("asks the user to unlock while the device is locked", async () => {
    const rig = await createRig({ lockedPolls: 1 });
    const stages: string[] = [];
    await (await rig.manager.open(rig.device.udid, { onProgress: (e) => stages.push(e.stage) })).close();
    expect(stages).toEqual(["waiting_for_unlock", "paired"]);
  });

  it("fails with pairing_denied when the user taps Don't Trust", async () => {
    const rig = await createRig({ denyPairing: true });
    expect(await codeOf(rig.manager.open(rig.device.udid))).toBe(ErrorCode.PairingDenied);
  });

  it("times out when nobody answers the trust dialog", async () => {
    const rig = await createRig({ pendingPolls: 1000 }, { pairingTimeoutMs: 5000, pairingPollIntervalMs: 1000 });
    expect(await codeOf(rig.manager.open(rig.device.udid))).toBe(ErrorCode.DeviceTimeout);
    expect(rig.sleeps.length).toBe(5);
  });

  it("keeps the record in the secret store when usbmuxd refuses it, and uses it next time", async () => {
    const rig = await createRig();
    rig.fake.refuseSavePairRecord = true;
    await (await rig.manager.open(rig.device.udid)).close();
    expect(rig.secrets.values.has(pairRecordSecretKey(rig.device.udid))).toBe(true);
    const pairsBefore = rig.device.requests.filter((r) => r === "lockdown:Pair").length;
    await (await rig.manager.open(rig.device.udid)).close();
    expect(rig.device.requests.filter((r) => r === "lockdown:Pair").length).toBe(pairsBefore);
  });

  it("does not pair when autoPair is off", async () => {
    const rig = await createRig();
    expect(await codeOf(rig.manager.open(rig.device.udid, { autoPair: false }))).toBe(ErrorCode.DeviceNotPaired);
  });

  it("pairs again when the device rejects a stale record", async () => {
    const rig = await createRig();
    await (await rig.manager.open(rig.device.udid)).close();
    rig.device.acceptedHostIds.clear(); // e.g. the user reset "Trust" settings
    await (await rig.manager.open(rig.device.udid)).close();
    expect(rig.device.requests.filter((r) => r === "lockdown:Pair")).toHaveLength(2);
  });

  it("exports and imports pair records", async () => {
    const rig = await createRig();
    await rig.manager.pair(rig.device.udid);
    const exported = await rig.manager.exportPairRecord(rig.device.udid);
    expect(parsePairRecord(exported).systemBuid).toBe(rig.fake.buid);
    rig.fake.pairRecords.clear();
    expect(await rig.manager.isPaired(rig.device.udid)).toBe(false);
    await rig.manager.importPairRecord(rig.device.udid, exported);
    expect(await rig.manager.isPaired(rig.device.udid)).toBe(true);
  });
});

describe("device checks", () => {
  it("reads info, passcode and Developer Mode", async () => {
    const rig = await createRig({ developerMode: false });
    const handle = await rig.manager.open(rig.device.udid);
    const check = await handle.check();
    expect(check.info.productVersion).toBe("18.2");
    expect(check.passcodeSet).toBe(true);
    expect(check.developerMode).toBe("off");
    await handle.revealDeveloperMode();
    expect(rig.device.requests).toContain("amfi:0");
    await handle.enableWifiDebugging();
    expect(rig.device.values.get("com.apple.mobile.wireless_lockdown/EnableWifiDebugging")).toBe(true);
    await handle.close();
  });

  it("does not require Developer Mode before iOS 16", async () => {
    const rig = await createRig({ productVersion: "15.8", developerMode: undefined });
    const handle = await rig.manager.open(rig.device.udid);
    expect((await handle.check()).developerMode).toBe("not_required");
    await handle.close();
  });
});

describe("installing apps", () => {
  it("uploads, installs with progress and removes the staged copy", async () => {
    const rig = await createRig();
    const handle = await rig.manager.open(rig.device.udid);
    const percents: number[] = [];
    await handle.installIpa(bytesFileSource("App.ipa", utf8Encode("IPA:com.example.app")), {
      onProgress: (p) => percents.push(p.percent),
    });
    expect(rig.device.apps.has("com.example.app")).toBe(true);
    expect(percents.at(-1)).toBe(100);
    expect([...percents].sort((a, b) => a - b)).toEqual(percents);
    expect([...rig.device.media.files.keys()]).toEqual([]);
    expect((await handle.listApps()).map((app) => app.bundleId)).toEqual(["com.example.app"]);
    expect((await handle.lookupApps(["com.example.app", "missing"])).has("com.example.app")).toBe(true);
    await handle.uninstall("com.example.app");
    expect(rig.device.apps.size).toBe(0);
    await handle.close();
  });

  it("reports installation_proxy errors by name and still cleans up", async () => {
    const rig = await createRig();
    const handle = await rig.manager.open(rig.device.udid);
    rig.device.nextInstallError = "ApplicationVerificationFailed";
    const error = await handle.installIpa(bytesFileSource("App.ipa", utf8Encode("IPA:x"))).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(LoadstarError);
    expect((error as LoadstarError).code).toBe(ErrorCode.InstallFailed);
    expect((error as LoadstarError).data?.installError).toBe("ApplicationVerificationFailed");
    expect([...rig.device.media.files.keys()]).toEqual([]);
    await handle.close();
  });

  it("stops uploading when aborted", async () => {
    const rig = await createRig({}, { afcWriteChunkBytes: 4 });
    const handle = await rig.manager.open(rig.device.udid);
    const controller = new AbortController();
    const install = handle.installIpa(bytesFileSource("App.ipa", utf8Encode("IPA:com.example.big")), {
      signal: controller.signal,
      onProgress: (p) => {
        if (p.stage === "uploading" && p.percent > 0) controller.abort();
      },
    });
    await expect(install).rejects.toBeDefined();
    expect(rig.device.apps.size).toBe(0);
    await handle.close();
  });
});

describe("profiles", () => {
  it("lists, installs, removes and cleans up stale profiles", async () => {
    const rig = await createRig();
    const now = new Date("2026-10-15T12:00:00Z");
    const later = new Date("2026-10-22T12:00:00Z");
    rig.device.profiles.push(
      fakeProfile({
        uuid: "EXPIRED",
        name: "old",
        teamId: "TEAM1",
        bundleId: "com.a",
        expires: new Date("2026-10-01T00:00:00Z"),
      }),
      fakeProfile({ uuid: "UNUSED", name: "gone", teamId: "TEAM1", bundleId: "com.gone", expires: later }),
      fakeProfile({ uuid: "INUSE", name: "kept", teamId: "TEAM1", bundleId: "com.kept", expires: later }),
      fakeProfile({ uuid: "OTHER", name: "other team", teamId: "TEAM2", bundleId: "com.other", expires: later }),
    );
    addApp(rig.device, "com.kept");
    const handle = await rig.manager.open(rig.device.udid);
    expect((await handle.listProfiles()).map((p) => p.uuid)).toEqual(["EXPIRED", "UNUSED", "INUSE", "OTHER"]);

    const removed = await handle.removeStaleProfiles({ now, teamId: "TEAM1" });
    expect(removed.map((p) => p.uuid)).toEqual(["EXPIRED", "UNUSED"]);
    expect((await handle.listProfiles()).map((p) => p.uuid)).toEqual(["INUSE", "OTHER"]);

    await handle.installProfile(fakeProfile({ uuid: "NEW", name: "n", teamId: "T", bundleId: "b", expires: later }));
    await handle.removeProfile("OTHER");
    expect((await handle.listProfiles()).map((p) => p.uuid)).toEqual(["INUSE", "NEW"]);
    await handle.close();
  });
});

describe("app files and pairing files", () => {
  it("places the pairing file into several apps", async () => {
    const rig = await createRig();
    const sidestore = addApp(rig.device, "com.SideStore.SideStore.TEAM1");
    const stik = addApp(rig.device, "com.stik.debug.TEAM1");
    const handle = await rig.manager.open(rig.device.udid);
    await handle.placePairingFile([
      { bundleId: sidestore.bundleId, path: "Documents/ALTPairingFile.mobiledevicepairing" },
      { bundleId: stik.bundleId, path: "Documents/pairingFile.plist" },
    ]);
    const written = sidestore.container.files.get("Documents/ALTPairingFile.mobiledevicepairing");
    const plist = parsePlist(written as Uint8Array) as Record<string, unknown>;
    expect(plist.RootPrivateKey).toBeUndefined(); // never leaves the computer
    expect(plist.HostPrivateKey).toBeInstanceOf(Uint8Array);
    const parsed = { udid: plist.UDID, hostId: plist.HostID };
    expect(parsed.udid).toBe(rig.device.udid);
    expect(parsed.hostId).toBe(handle.pairRecord.hostId);
    expect(stik.container.files.has("Documents/pairingFile.plist")).toBe(true);
    expect(
      parsePlist(await handle.readAppFile({ bundleId: stik.bundleId, path: "Documents/pairingFile.plist" })),
    ).toBeDefined();
    await handle.close();
  });

  it("creates missing folders and reports unknown apps", async () => {
    const rig = await createRig();
    const app = addApp(rig.device, "com.example.app");
    const handle = await rig.manager.open(rig.device.udid);
    await handle.writeAppFile({ bundleId: app.bundleId, path: "Library/Config/settings.plist" }, utf8Encode("x"));
    expect(app.container.files.has("Library/Config/settings.plist")).toBe(true);
    expect(await codeOf(handle.writeAppFile({ bundleId: "com.missing", path: "a" }, utf8Encode("x")))).toBe(
      ErrorCode.ServiceUnavailable,
    );
    await handle.close();
  });
});

describe("automatic pairing placement", () => {
  it("finds the user's pairing apps and writes each file they read", async () => {
    const rig = await createRig();
    const sidestore = addApp(rig.device, "com.SideStore.SideStore.ABCDE12345");
    const stik = addApp(rig.device, "com.stik.stikdebug");
    addApp(rig.device, "com.example.unrelated");
    addApp(rig.device, "com.SideStore.SideStore.ABCDE12345.Widget"); // an extension is not an app match
    const impostor = addApp(rig.device, "com.SideStore.SideStore.EVILTEAM00"); // another team's copy
    const handle = await rig.manager.open(rig.device.udid);
    const targets = await handle.pairingTargets(["ABCDE12345"]);
    expect(new Set(targets.map((t) => t.appName))).toEqual(new Set(["SideStore", "StikDebug"]));
    const placed = await handle.placePairingFile(targets);
    expect(impostor.container.files.size).toBe(0);
    expect(placed.map((t) => `${t.bundleId}:${t.path}`).sort()).toEqual([
      "com.SideStore.SideStore.ABCDE12345:Documents/ALTPairingFile.mobiledevicepairing",
      "com.SideStore.SideStore.ABCDE12345:Documents/PairingFile_Lockdown.plist",
      "com.stik.stikdebug:Documents/pairingFile.plist",
    ]);
    expect(rig.device.values.get("com.apple.mobile.wireless_lockdown/EnableWifiDebugging")).toBe(true);
    expect(sidestore.container.files.size).toBe(2);
    expect(stik.container.files.size).toBe(1);
    const status = await handle.appFileStatus(placed);
    expect(status.every((s) => s.exists && (s.size ?? 0) > 0)).toBe(true);
    await handle.close();
  });

  it("requires a passcode for Wi-Fi debugging", async () => {
    const rig = await createRig({ passwordProtected: false });
    addApp(rig.device, "com.SideStore.SideStore.ABCDE12345");
    const handle = await rig.manager.open(rig.device.udid);
    const targets = await handle.pairingTargets(["ABCDE12345"]);
    expect(await codeOf(handle.placePairingFile(targets))).toBe(ErrorCode.PasscodeRequired);
    await handle.close();
  });
});

describe("install failure classification", () => {
  it.each([
    [
      "ApplicationVerificationFailed",
      "Failed to verify code signature of SideStore.app : 0xe8008024 (The provisioning profile is banned.)",
      ErrorCode.ProfileBanned,
    ],
    [
      "ApplicationVerificationFailed",
      "… 0xe8008018 (The identity used to sign the executable is no longer valid.)",
      ErrorCode.SigningIdentityInvalid,
    ],
    [
      "ApplicationVerificationFailed",
      "… 0xe8008015 (A valid provisioning profile for this executable was not found.)",
      ErrorCode.ProfileNotFound,
    ],
    ["DeviceNotSupportedByThinning", "", ErrorCode.InstallFailed],
  ])("%s / %s → %s", async (error, description, expected) => {
    const rig = await createRig();
    const handle = await rig.manager.open(rig.device.udid);
    rig.device.nextInstallError = error;
    rig.device.nextInstallDescription = description;
    expect(await codeOf(handle.installIpa(bytesFileSource("a.ipa", utf8Encode("IPA:a"))))).toBe(expected);
    await handle.close();
  });

  it("lists the apps counted against the free-profile limit", async () => {
    const rig = await createRig();
    const handle = await rig.manager.open(rig.device.udid);
    rig.device.nextInstallError = "ApplicationVerificationFailed";
    rig.device.nextInstallDescription =
      "This device has reached the maximum number of installed apps using a free developer profile: {(T.com.a.T, T.com.b.T, T.com.c.T)}";
    const error = await handle.installIpa(bytesFileSource("a.ipa", utf8Encode("IPA:a"))).catch((e: unknown) => e);
    expect((error as LoadstarError).code).toBe(ErrorCode.FreeAppLimit);
    expect((error as LoadstarError).data?.freeProfileApps).toEqual(["T.com.a.T", "T.com.b.T", "T.com.c.T"]);
    await handle.close();
  });
});
