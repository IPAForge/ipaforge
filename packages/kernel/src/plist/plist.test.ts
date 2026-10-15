import { utf8Encode } from "@kernel/bytes/bytes.ts";
import { ErrorCode } from "@kernel/errors/codes.ts";
import { createDict, DEFAULT_PLIST_LIMITS, parsePlist, real, serializeXmlPlist } from "@kernel/plist/index.ts";
import { describe, expect, it } from "vitest";

describe("plist", () => {
  it("round-trips every value type through the XML writer and parser", () => {
    const value = createDict([
      ["string", "héllo"],
      ["integer", 42],
      ["big", 2n ** 60n],
      ["real", real(1.5)],
      ["bool", true],
      ["data", new Uint8Array([1, 2, 3])],
      ["date", new Date("2026-10-15T00:00:00Z")],
      ["array", ["a", createDict([["nested", false]])]],
    ]);
    expect(parsePlist(serializeXmlPlist(value))).toEqual(value);
  });

  it("rejects malformed input with plist.invalid", () => {
    expect(() => parsePlist(utf8Encode("<plist><dict><key>x</key></plist>"))).toThrow(
      expect.objectContaining({ code: ErrorCode.InvalidPlist }),
    );
  });

  it("honours depth limits", () => {
    const deep = `<plist>${"<array>".repeat(5)}${"</array>".repeat(5)}</plist>`;
    expect(() => parsePlist(utf8Encode(deep), { ...DEFAULT_PLIST_LIMITS, maxDepth: 3 })).toThrow(
      expect.objectContaining({ code: ErrorCode.InvalidPlist }),
    );
  });

  it("accepts a bare root value without the <plist> wrapper (Apple session data)", () => {
    const bare = utf8Encode("<dict><key>adsid</key><string>x</string><key>n</key><integer>3</integer></dict>\n");
    expect(parsePlist(bare)).toEqual(
      createDict([
        ["adsid", "x"],
        ["n", 3],
      ]),
    );
    expect(() => parsePlist(utf8Encode("<dict></dict><dict></dict>"))).toThrow(
      expect.objectContaining({ code: ErrorCode.InvalidPlist }),
    );
  });
});
