import { compact } from "@kernel/objects/compact.ts";
import { describe, expect, it } from "vitest";

interface Release {
  readonly url: string;
  readonly size?: number;
  readonly note?: string;
}

describe("compact", () => {
  it("drops undefined fields and keeps falsy values", () => {
    const size: number | undefined = undefined;
    const release: Release = compact({ url: "https://x", size, note: "" });
    expect(release).toEqual({ url: "https://x", note: "" });
    expect("size" in release).toBe(false);
    expect(compact({ zero: 0, no: false, nothing: null })).toEqual({ zero: 0, no: false, nothing: null });
  });
});
