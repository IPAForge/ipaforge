import { ErrorCode } from "@kernel/errors/codes.ts";
import { parseDate, parseInteger, parseReal } from "@kernel/plist/xml-scalars.ts";
import { describe, expect, it } from "vitest";

describe("XML plist scalars", () => {
  it("parses decimal and hex integers, keeping large ones as bigint", () => {
    expect(parseInteger(" 42 ", 0)).toBe(42);
    expect(parseInteger("-0x10", 0)).toBe(-16);
    expect(parseInteger("9007199254740993", 0)).toBe(9007199254740993n);
    expect(() => parseInteger("4.2", 7)).toThrow(expect.objectContaining({ code: ErrorCode.InvalidPlist }));
  });

  it("parses reals including the CoreFoundation spellings of NaN and infinity", () => {
    expect(parseReal("1.5", 0)).toBe(1.5);
    expect(parseReal("NaN", 0)).toBeNaN();
    expect(parseReal("+infinity", 0)).toBe(Infinity);
    expect(parseReal("-inf", 0)).toBe(-Infinity);
    expect(() => parseReal("one", 0)).toThrow(expect.objectContaining({ code: ErrorCode.InvalidPlist }));
  });

  it("parses ISO 8601 dates", () => {
    expect(parseDate(" 2026-10-15T00:00:00Z ", 0)).toEqual(new Date("2026-10-15T00:00:00Z"));
    expect(() => parseDate("yesterday", 0)).toThrow(expect.objectContaining({ code: ErrorCode.InvalidPlist }));
  });
});
