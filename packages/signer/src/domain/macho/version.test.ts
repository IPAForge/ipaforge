import { isVersionAtLeast } from "@signer/domain/macho/version.ts";
import { describe, expect, it } from "vitest";

describe("isVersionAtLeast", () => {
  it.each([
    ["26.1", "15.0", true],
    ["15.0", "26.1", false],
    ["15.0", "15", true],
    ["15", "15.0.0", true],
    ["15.0", "15.0.1", false],
    ["15.0.1", "15.0", true],
    ["9.3.5", "10.0", false],
    ["10.0", "9.3.5", true],
    ["16.10", "16.9", true],
    ["16.9", "16.10", false],
    ["17.4.1", "17.4.1", true],
  ])("%s ≥ %s is %s", (version, minimum, expected) => {
    expect(isVersionAtLeast(version, minimum)).toBe(expected);
  });
});
