import { RECOVERY_CATALOGUE } from "@installer/diagnostics/catalogue.ts";
import { classify } from "@installer/diagnostics/classify.ts";
import { RecoveryAction } from "@installer/diagnostics/recovery.ts";
import { ErrorCode, LoadstarError } from "@loadstar/kernel";
import { describe, expect, it } from "vitest";

const known = new Set<string>(Object.values(RecoveryAction));

describe("classify", () => {
  it("gives every ErrorCode at least one known recovery action", () => {
    for (const code of Object.values(ErrorCode)) {
      const { recovery } = classify(new LoadstarError(code));
      expect(recovery.length, code).toBeGreaterThan(0);
      for (const action of recovery) expect(known.has(action), `${code}: ${action}`).toBe(true);
    }
    expect(Object.keys(RECOVERY_CATALOGUE).sort()).toEqual(Object.values(ErrorCode).sort());
  });

  it.each([
    [ErrorCode.ProfileBanned, ["switch-account"]],
    [ErrorCode.DeviceLocked, ["unlock-device", "retry"]],
    [ErrorCode.DeveloperModeOff, ["enable-developer-mode", "retry"]],
    [ErrorCode.CertificateLimit, ["revoke-certificate", "switch-account"]],
    [ErrorCode.FreeAppLimit, ["choose-app-to-remove", "retry"]],
    [ErrorCode.AnisetteUnavailable, ["change-anisette-server", "check-network", "retry"]],
    [ErrorCode.AppIdQuotaExceeded, ["wait-for-app-id-slot", "switch-account"]],
  ])("maps %s to its recovery", (code, recovery) => {
    expect(classify(new LoadstarError(code))).toEqual({ code, recovery });
  });

  it("looks through a step-failed wrapper to the catalogued cause", () => {
    const wrapped = new LoadstarError(ErrorCode.StepFailed, { cause: new LoadstarError(ErrorCode.DeviceTimeout) });
    expect(classify(wrapped).code).toBe(ErrorCode.DeviceTimeout);
    const foreign = new LoadstarError(ErrorCode.StepFailed, { cause: new TypeError("x is undefined") });
    expect(classify(foreign).code).toBe(ErrorCode.StepFailed);
  });

  it("never leaves a foreign error uncatalogued", () => {
    expect(classify(new Error("boom")).code).toBe(ErrorCode.Unexpected);
    expect(classify("a string").code).toBe(ErrorCode.Unexpected);
    expect(classify(undefined).code).toBe(ErrorCode.Unexpected);
    expect(classify(Object.assign(new Error("offline"), { code: "net.offline" })).code).toBe(ErrorCode.Offline);
    expect(classify(new DOMException("stop", "AbortError")).code).toBe(ErrorCode.Aborted);
  });
});
