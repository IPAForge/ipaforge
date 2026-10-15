import { ErrorCode, LoadstarError } from "@kernel/errors/index.ts";
import { createLogger, parseLogLevel } from "@kernel/logging/create-logger.ts";
import { REDACTED, redact } from "@kernel/logging/redact.ts";
import { compact } from "@kernel/objects/compact.ts";
import { fixedClock } from "@kernel/ports/clock.ts";
import type { LogRecord } from "@kernel/ports/logger.ts";
import { describe, expect, it, vi } from "vitest";

const collect = (level?: "debug" | "info" | "warn" | "error") => {
  const records: LogRecord[] = [];
  const logger = createLogger(
    compact({
      sink: (record: LogRecord) => records.push(record),
      clock: fixedClock(new Date("2026-10-13T12:00:00Z")),
      level,
    }),
  );
  return { logger, records };
};

describe("createLogger", () => {
  it("filters below the configured level", () => {
    const { logger, records } = collect("warn");
    logger.debug("d");
    logger.info("i");
    logger.warn("w");
    logger.error("e");
    expect(records.map((r) => r.level)).toEqual(["warn", "error"]);
  });

  it("defaults to info", () => {
    const { logger, records } = collect();
    logger.debug("hidden");
    logger.info("shown");
    expect(records.map((r) => r.msg)).toEqual(["shown"]);
  });

  it("emits structured records with timestamp and fields", () => {
    const { logger, records } = collect("debug");
    logger.info("signed binary", { identifier: "com.example", ms: 12 });
    expect(records[0]).toEqual({
      ts: "2026-10-13T12:00:00.000Z",
      level: "info",
      scope: undefined,
      msg: "signed binary",
      fields: { identifier: "com.example", ms: 12 },
    });
  });

  it("composes child scopes and bindings", () => {
    const { logger, records } = collect("debug");
    logger.child({ scope: "signer" }).child({ scope: "cms", bundle: "A.app" }).debug("built");
    expect(records[0]?.scope).toBe("signer.cms");
    expect(records[0]?.fields).toEqual({ bundle: "A.app" });
  });

  it("redacts secrets in fields", () => {
    const { logger, records } = collect("debug");
    logger.info("login", { appleId: "a@b.c", password: "hunter2", headers: { "X-Apple-I-MD": "otp" } });
    expect(records[0]?.fields).toEqual({ appleId: "a@b.c", password: REDACTED, headers: { "X-Apple-I-MD": REDACTED } });
  });

  it("never throws when the sink throws", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const logger = createLogger({
      sink: () => {
        throw new Error("disk full");
      },
    });
    expect(() => logger.error("boom")).not.toThrow();
    expect(spy).toHaveBeenCalledOnce();
    spy.mockRestore();
  });
});

describe("redact", () => {
  it("masks nested keys and keys inside arrays, case-insensitively", () => {
    const input = {
      account: { Password: "x", sessionToken: "y", name: "ok" },
      devices: [{ UDID: "0000", model: "iPhone" }],
      privateKey: "k",
    };
    expect(redact(input)).toEqual({
      account: { Password: REDACTED, sessionToken: REDACTED, name: "ok" },
      devices: [{ UDID: REDACTED, model: "iPhone" }],
      privateKey: REDACTED,
    });
  });

  it("does not mutate its input", () => {
    const input = { password: "x", nested: { token: "y" } };
    const snapshot = structuredClone(input);
    redact(input);
    expect(input).toEqual(snapshot);
  });

  it("summarises binary data and serialises errors", () => {
    const error = new LoadstarError(ErrorCode.DeviceLocked, { data: { udid: "secret-udid" } });
    expect(redact({ blob: new Uint8Array(10), error })).toEqual({
      blob: "<10 bytes>",
      error: { name: "LoadstarError", message: "device.locked", code: "device.locked", data: { udid: REDACTED } },
    });
  });

  it("breaks cycles", () => {
    const node: Record<string, unknown> = { name: "a" };
    node.self = node;
    expect(redact(node)).toEqual({ name: "a", self: "[circular]" });
  });

  it("does not over-match ordinary keys", () => {
    expect(redact({ bundleKey: "a", keychainGroups: ["x"], keys: 3 })).toEqual({
      bundleKey: "a",
      keychainGroups: ["x"],
      keys: 3,
    });
  });
});

describe("parseLogLevel", () => {
  it.each([
    ["debug", "debug"],
    [" WARN ", "warn"],
    ["verbose", "info"],
    [undefined, "info"],
  ] as const)("%s → %s", (input, expected) => {
    expect(parseLogLevel(input)).toBe(expected);
  });
});
