import { parseDeviceProbeArgs } from "@desktop/probes/device/args.ts";
import { describe, expect, it } from "vitest";

describe("device-probe arguments", () => {
  it("defaults to the list command", () => {
    const args = parseDeviceProbeArgs([]);
    expect(args.command).toBe("list");
    expect(args.rest).toEqual([]);
  });

  it("separates the command, positional arguments, flags and the --udid value", () => {
    const args = parseDeviceProbeArgs(["place", "--udid", "abc", "TEAM1", "--yes", "TEAM2"]);
    expect(args.command).toBe("place");
    expect(args.rest).toEqual(["TEAM1", "TEAM2"]);
    expect(args.option("udid")).toBe("abc");
    expect(args.flag("yes")).toBe(true);
    expect(args.flag("only-missing")).toBe(false);
    expect(args.option("missing")).toBeUndefined();
  });
});
